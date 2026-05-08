import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from app.db.models import ClauseCreate

CONTRACT_ID = "33333333-3333-3333-3333-333333333333"


def _clause(clause_type: str, severity: str = "medium", raw_text: str = "Sample text.") -> ClauseCreate:
    return ClauseCreate(
        contract_id=UUID(CONTRACT_ID),
        clause_type=clause_type,
        severity=severity,
        raw_text=raw_text,
        page_ref=1,
    )


def _llm_resp(severity: str, reason: str = "Test reason.") -> MagicMock:
    mock = MagicMock()
    mock.content = json.dumps({"severity": severity, "reason": reason})
    return mock


@pytest.fixture
def mock_scorer_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.services.scorer.get_service_client", lambda: mock_client)
    return mock_client


@pytest.fixture
def mock_scorer_llm(monkeypatch):
    instance = MagicMock()
    instance.ainvoke = AsyncMock(return_value=_llm_resp("high"))
    monkeypatch.setattr("app.services.scorer.ChatOpenAI", MagicMock(return_value=instance))
    return instance


# --- score_clauses ---

async def test_score_clauses_known_type_skips_llm(mock_scorer_llm, mock_scorer_supabase):
    from app.services.scorer import score_clauses

    clauses = [_clause("indemnification", severity="critical")]
    result = await score_clauses(clauses, CONTRACT_ID)

    assert len(result) == 1
    assert result[0].severity == "critical"
    mock_scorer_llm.ainvoke.assert_not_called()


async def test_score_clauses_known_type_no_db_update(mock_scorer_llm, mock_scorer_supabase):
    from app.services.scorer import score_clauses

    await score_clauses([_clause("governing_law", severity="low")], CONTRACT_ID)
    mock_scorer_supabase.table.assert_not_called()


async def test_score_clauses_unknown_type_calls_llm(mock_scorer_llm, mock_scorer_supabase):
    from app.services.scorer import score_clauses

    mock_scorer_llm.ainvoke.return_value = _llm_resp("high")
    result = await score_clauses([_clause("non_compete", severity="medium")], CONTRACT_ID)

    assert result[0].severity == "high"
    mock_scorer_llm.ainvoke.assert_called_once()


async def test_score_clauses_unknown_type_updates_db(mock_scorer_llm, mock_scorer_supabase):
    from app.services.scorer import score_clauses

    mock_scorer_llm.ainvoke.return_value = _llm_resp("critical")
    await score_clauses([_clause("non_compete", raw_text="No competing for 2 years.")], CONTRACT_ID)

    mock_scorer_supabase.table.assert_called_with("clauses")
    update_call = mock_scorer_supabase.table.return_value.update.call_args[0][0]
    assert update_call["severity"] == "critical"
    # Filter must use raw_text as the second .eq(), not clause_type
    # Chain: .update({...}).eq("contract_id", ...).eq("raw_text", ...)
    second_eq_calls = mock_scorer_supabase.table.return_value.update.return_value.eq.return_value.eq.call_args_list
    filter_cols = [c.args[0] for c in second_eq_calls]
    assert "raw_text" in filter_cols
    assert "clause_type" not in filter_cols


async def test_score_clauses_two_unknown_types_get_independent_severities(mock_scorer_llm, mock_scorer_supabase):
    """Two distinct unknown-type clauses with the same clause_type get separate LLM calls."""
    from app.services.scorer import score_clauses

    mock_scorer_llm.ainvoke.side_effect = [
        _llm_resp("critical"),
        _llm_resp("low"),
    ]
    clauses = [
        _clause("non_compete", raw_text="No competing for 2 years."),
        _clause("non_compete", raw_text="Seller may not solicit customers for 1 year."),
    ]
    result = await score_clauses(clauses, CONTRACT_ID)

    assert mock_scorer_llm.ainvoke.call_count == 2
    assert result[0].severity == "critical"
    assert result[1].severity == "low"


async def test_score_clauses_empty_returns_empty(mock_scorer_llm, mock_scorer_supabase):
    from app.services.scorer import score_clauses

    result = await score_clauses([], CONTRACT_ID)
    assert result == []
    mock_scorer_llm.ainvoke.assert_not_called()


async def test_score_clauses_llm_failure_keeps_existing_severity(mock_scorer_llm, mock_scorer_supabase):
    mock_scorer_llm.ainvoke.side_effect = Exception("LLM unavailable")

    from app.services.scorer import score_clauses

    clause = _clause("non_compete", severity="medium")
    result = await score_clauses([clause], CONTRACT_ID)

    assert len(result) == 1
    assert result[0].severity == "medium"


async def test_score_clauses_llm_failure_no_db_update(mock_scorer_llm, mock_scorer_supabase):
    mock_scorer_llm.ainvoke.side_effect = Exception("LLM unavailable")

    from app.services.scorer import score_clauses

    await score_clauses([_clause("non_compete")], CONTRACT_ID)
    mock_scorer_supabase.table.assert_not_called()


async def test_score_clauses_mixed_known_and_unknown(mock_scorer_llm, mock_scorer_supabase):
    from app.services.scorer import score_clauses

    mock_scorer_llm.ainvoke.return_value = _llm_resp("low")
    clauses = [
        _clause("indemnification", severity="critical"),
        _clause("non_compete", severity="medium"),
        _clause("auto_renewal", severity="high"),
    ]
    result = await score_clauses(clauses, CONTRACT_ID)

    assert len(result) == 3
    assert result[0].severity == "critical"   # known — unchanged
    assert result[1].severity == "low"         # unknown — LLM assigned
    assert result[2].severity == "high"        # known — unchanged
    assert mock_scorer_llm.ainvoke.call_count == 1


# --- compute_overall_risk ---

def test_compute_overall_risk_returns_critical_when_present():
    from app.services.scorer import compute_overall_risk

    clauses = [
        _clause("indemnification", severity="critical"),
        _clause("governing_law", severity="low"),
    ]
    assert compute_overall_risk(clauses) == "critical"


def test_compute_overall_risk_returns_high_when_no_critical():
    from app.services.scorer import compute_overall_risk

    clauses = [
        _clause("auto_renewal", severity="high"),
        _clause("governing_law", severity="low"),
    ]
    assert compute_overall_risk(clauses) == "high"


def test_compute_overall_risk_returns_medium():
    from app.services.scorer import compute_overall_risk

    clauses = [
        _clause("termination", severity="medium"),
        _clause("governing_law", severity="low"),
    ]
    assert compute_overall_risk(clauses) == "medium"


def test_compute_overall_risk_returns_low_when_all_low():
    from app.services.scorer import compute_overall_risk

    clauses = [_clause("governing_law", severity="low")]
    assert compute_overall_risk(clauses) == "low"


def test_compute_overall_risk_empty_clauses_returns_low():
    from app.services.scorer import compute_overall_risk

    assert compute_overall_risk([]) == "low"


def test_compute_overall_risk_critical_beats_all():
    from app.services.scorer import compute_overall_risk

    clauses = [
        _clause("a", severity="low"),
        _clause("b", severity="medium"),
        _clause("c", severity="high"),
        _clause("d", severity="critical"),
    ]
    assert compute_overall_risk(clauses) == "critical"


# --- _parse_severity ---

def test_parse_severity_valid_json():
    from app.services.scorer import _parse_severity

    result = _parse_severity(json.dumps({"severity": "high", "reason": "Risky."}))
    assert result == "high"


def test_parse_severity_strips_markdown_fences():
    from app.services.scorer import _parse_severity

    content = '```json\n{"severity": "critical", "reason": "Very risky."}\n```'
    assert _parse_severity(content) == "critical"


def test_parse_severity_invalid_json_returns_medium():
    from app.services.scorer import _parse_severity

    assert _parse_severity("Not JSON") == "medium"


def test_parse_severity_unknown_value_returns_medium():
    from app.services.scorer import _parse_severity

    result = _parse_severity(json.dumps({"severity": "extreme", "reason": "Off the charts."}))
    assert result == "medium"


def test_parse_severity_case_insensitive():
    from app.services.scorer import _parse_severity

    result = _parse_severity(json.dumps({"severity": "HIGH", "reason": "Uppercase."}))
    assert result == "high"
