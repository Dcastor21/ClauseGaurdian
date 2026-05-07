import json
from unittest.mock import AsyncMock, MagicMock, call
from uuid import UUID

import pytest

from app.db.models import ClauseCreate

CONTRACT_ID = "44444444-4444-4444-4444-444444444444"
USER_ID = "user_test456"

GOOD_SUMMARY = "This clause means the vendor will cover you if something goes wrong. It matters because without it, you pay for any legal claims. Ignoring it could expose you to unlimited liability."
GOOD_ACTION = "Review this clause with your legal team before signing and negotiate a mutual indemnification."


def _clause(
    clause_type: str = "indemnification",
    raw_text: str = "Vendor shall indemnify and hold harmless the client.",
    severity: str = "critical",
) -> ClauseCreate:
    return ClauseCreate(
        contract_id=UUID(CONTRACT_ID),
        clause_type=clause_type,
        severity=severity,
        raw_text=raw_text,
        page_ref=1,
    )


def _llm_resp(summary: str = GOOD_SUMMARY, action: str = GOOD_ACTION) -> MagicMock:
    mock = MagicMock()
    mock.content = json.dumps({"summary": summary, "recommended_action": action})
    return mock


@pytest.fixture
def mock_summarizer_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.services.summarizer.get_service_client", lambda: mock_client)
    return mock_client


@pytest.fixture
def mock_summarizer_llm(monkeypatch):
    instance = MagicMock()
    instance.ainvoke = AsyncMock(return_value=_llm_resp())
    monkeypatch.setattr("app.services.summarizer.ChatOpenAI", MagicMock(return_value=instance))
    return instance


# --- summarize_clauses ---

async def test_summarize_empty_clauses_returns_immediately(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    await summarize_clauses([], CONTRACT_ID, USER_ID)
    mock_summarizer_llm.ainvoke.assert_not_called()
    mock_summarizer_supabase.table.assert_not_called()


async def test_summarize_calls_llm_once_per_clause(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    clauses = [
        _clause("indemnification", raw_text="Vendor shall indemnify client."),
        _clause("auto_renewal", raw_text="Contract renews annually."),
        _clause("governing_law", raw_text="Governed by California law."),
    ]
    await summarize_clauses(clauses, CONTRACT_ID, USER_ID)
    assert mock_summarizer_llm.ainvoke.call_count == 3


async def test_summarize_writes_summary_and_action_to_db(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    await summarize_clauses([_clause()], CONTRACT_ID, USER_ID)

    mock_summarizer_supabase.table.assert_called_with("clauses")
    update_call = mock_summarizer_supabase.table.return_value.update.call_args[0][0]
    assert update_call["summary"] == GOOD_SUMMARY
    assert update_call["recommended_action"] == GOOD_ACTION


async def test_summarize_filters_db_update_by_contract_id_and_raw_text(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    raw = "Vendor shall indemnify and hold harmless the client."
    await summarize_clauses([_clause(raw_text=raw)], CONTRACT_ID, USER_ID)

    # .update(...).eq("contract_id", ...).eq("raw_text", ...).execute()
    # first eq is on update.return_value; second eq is on that's return_value
    first_eq = mock_summarizer_supabase.table.return_value.update.return_value
    assert first_eq.eq.call_args == call("contract_id", CONTRACT_ID)

    second_eq = first_eq.eq.return_value
    assert second_eq.eq.call_args == call("raw_text", raw)


async def test_summarize_llm_failure_on_one_clause_continues_to_next(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    mock_summarizer_llm.ainvoke.side_effect = [
        Exception("LLM timeout"),
        _llm_resp("Second clause summary.", "Second action."),
    ]
    clauses = [
        _clause("indemnification", raw_text="First clause."),
        _clause("auto_renewal", raw_text="Second clause."),
    ]
    await summarize_clauses(clauses, CONTRACT_ID, USER_ID)

    assert mock_summarizer_llm.ainvoke.call_count == 2
    # DB update only for the second clause (first failed)
    assert mock_summarizer_supabase.table.return_value.update.call_count == 1


async def test_summarize_db_write_failure_continues_to_next_clause(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    mock_summarizer_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.side_effect = [
        Exception("DB write failed"),
        None,
    ]
    clauses = [
        _clause("indemnification", raw_text="First clause."),
        _clause("auto_renewal", raw_text="Second clause."),
    ]
    await summarize_clauses(clauses, CONTRACT_ID, USER_ID)

    # Both LLM calls fired despite the first DB write failing
    assert mock_summarizer_llm.ainvoke.call_count == 2


async def test_summarize_all_llm_failures_makes_no_db_writes(mock_summarizer_llm, mock_summarizer_supabase):
    from app.services.summarizer import summarize_clauses

    mock_summarizer_llm.ainvoke.side_effect = Exception("LLM down")
    await summarize_clauses([_clause(), _clause("governing_law", raw_text="Governed by NY law.")], CONTRACT_ID, USER_ID)

    mock_summarizer_supabase.table.assert_not_called()


# --- _parse_summary ---

def test_parse_summary_valid_json():
    from app.services.summarizer import _parse_summary

    content = json.dumps({"summary": "This is a summary.", "recommended_action": "Do this now."})
    summary, action = _parse_summary(content)
    assert summary == "This is a summary."
    assert action == "Do this now."


def test_parse_summary_strips_json_markdown_fence():
    from app.services.summarizer import _parse_summary

    content = '```json\n{"summary": "Summary text.", "recommended_action": "Action text."}\n```'
    summary, action = _parse_summary(content)
    assert summary == "Summary text."
    assert action == "Action text."


def test_parse_summary_strips_plain_markdown_fence():
    from app.services.summarizer import _parse_summary

    content = '```\n{"summary": "Plain fence.", "recommended_action": "Plain action."}\n```'
    summary, action = _parse_summary(content)
    assert summary == "Plain fence."


def test_parse_summary_invalid_json_raises():
    from app.services.summarizer import _parse_summary

    with pytest.raises(ValueError):
        _parse_summary("Not valid JSON at all.")


def test_parse_summary_missing_summary_field_raises():
    from app.services.summarizer import _parse_summary

    with pytest.raises(ValueError):
        _parse_summary(json.dumps({"recommended_action": "Do something."}))


def test_parse_summary_missing_action_field_raises():
    from app.services.summarizer import _parse_summary

    with pytest.raises(ValueError):
        _parse_summary(json.dumps({"summary": "Some summary."}))


def test_parse_summary_empty_summary_raises():
    from app.services.summarizer import _parse_summary

    with pytest.raises(ValueError):
        _parse_summary(json.dumps({"summary": "", "recommended_action": "Action."}))


def test_parse_summary_empty_action_raises():
    from app.services.summarizer import _parse_summary

    with pytest.raises(ValueError):
        _parse_summary(json.dumps({"summary": "Summary.", "recommended_action": ""}))
