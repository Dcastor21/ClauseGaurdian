import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.documents import Document

CONTRACT_ID = "55555555-5555-5555-5555-555555555555"


def _chunk(text: str, page: int = 1) -> Document:
    return Document(page_content=text, metadata={"page": page, "contract_id": CONTRACT_ID})


def _llm_resp(deadlines: list[dict]) -> MagicMock:
    mock = MagicMock()
    mock.content = json.dumps({"deadlines": deadlines})
    return mock


@pytest.fixture
def mock_deadlines_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.services.deadlines.get_service_client", lambda: mock_client)
    return mock_client


@pytest.fixture
def mock_deadlines_llm(monkeypatch):
    instance = MagicMock()
    instance.ainvoke = AsyncMock(return_value=_llm_resp([]))
    monkeypatch.setattr("app.services.deadlines.ChatOpenAI", MagicMock(return_value=instance))
    return instance


# --- extract_deadlines ---

async def test_extract_deadlines_empty_chunks_returns_early(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    await extract_deadlines([], CONTRACT_ID)
    mock_deadlines_llm.ainvoke.assert_not_called()
    mock_deadlines_supabase.table.assert_not_called()


async def test_extract_deadlines_no_dates_found_makes_no_db_write(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.return_value = _llm_resp([])
    await extract_deadlines([_chunk("No dates here.")], CONTRACT_ID)
    mock_deadlines_supabase.table.assert_not_called()


async def test_extract_deadlines_writes_four_rows_per_date(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import ALERT_WINDOWS, extract_deadlines

    mock_deadlines_llm.ainvoke.return_value = _llm_resp([
        {"deadline_date": "2025-12-31", "description": "contract expiry"}
    ])
    await extract_deadlines([_chunk("Contract expires on December 31, 2025.")], CONTRACT_ID)

    mock_deadlines_supabase.table.assert_called_with("deadlines")
    insert_call = mock_deadlines_supabase.table.return_value.insert.call_args[0][0]
    assert len(insert_call) == len(ALERT_WINDOWS)
    alert_types = {row["alert_type"] for row in insert_call}
    assert alert_types == set(ALERT_WINDOWS)


async def test_extract_deadlines_all_rows_have_correct_contract_id(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.return_value = _llm_resp([
        {"deadline_date": "2025-06-01", "description": "payment due"}
    ])
    await extract_deadlines([_chunk("Payment due June 1 2025.")], CONTRACT_ID)

    rows = mock_deadlines_supabase.table.return_value.insert.call_args[0][0]
    assert all(r["contract_id"] == CONTRACT_ID for r in rows)
    assert all(r["alert_status"] == "pending" for r in rows)


async def test_extract_deadlines_deduplicates_same_date_across_chunks(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.return_value = _llm_resp([
        {"deadline_date": "2025-12-31", "description": "expiry"}
    ])
    await extract_deadlines(
        [_chunk("text 1"), _chunk("text 2")],
        CONTRACT_ID,
    )
    # Only one insert call despite two chunks returning the same date
    assert mock_deadlines_supabase.table.return_value.insert.call_count == 1


async def test_extract_deadlines_two_different_dates_each_get_four_rows(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.side_effect = [
        _llm_resp([{"deadline_date": "2025-06-01", "description": "payment"}]),
        _llm_resp([{"deadline_date": "2025-12-31", "description": "expiry"}]),
    ]
    await extract_deadlines([_chunk("chunk1"), _chunk("chunk2")], CONTRACT_ID)
    assert mock_deadlines_supabase.table.return_value.insert.call_count == 2


async def test_extract_deadlines_llm_failure_on_chunk_is_logged_and_continues(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.side_effect = [
        Exception("LLM timeout"),
        _llm_resp([{"deadline_date": "2025-12-31", "description": "expiry"}]),
    ]
    await extract_deadlines([_chunk("chunk1"), _chunk("chunk2")], CONTRACT_ID)

    # Should still write rows for the second chunk's date
    assert mock_deadlines_supabase.table.return_value.insert.call_count == 1


async def test_extract_deadlines_invalid_date_format_is_skipped(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.return_value = _llm_resp([
        {"deadline_date": "not-a-date", "description": "bad"},
        {"deadline_date": "2025-09-15", "description": "good"},
    ])
    await extract_deadlines([_chunk("text")], CONTRACT_ID)

    rows = mock_deadlines_supabase.table.return_value.insert.call_args[0][0]
    assert all(r["deadline_date"] == "2025-09-15" for r in rows)


async def test_extract_deadlines_db_write_failure_is_logged_not_raised(mock_deadlines_llm, mock_deadlines_supabase):
    from app.services.deadlines import extract_deadlines

    mock_deadlines_llm.ainvoke.return_value = _llm_resp([
        {"deadline_date": "2025-12-31", "description": "expiry"}
    ])
    mock_deadlines_supabase.table.return_value.insert.return_value.execute.side_effect = Exception("DB error")

    # Should not raise
    await extract_deadlines([_chunk("text")], CONTRACT_ID)


# --- _parse_response ---

def test_parse_response_valid_json():
    from app.services.deadlines import _parse_response

    content = json.dumps({"deadlines": [{"deadline_date": "2025-12-31", "description": "expiry"}]})
    result = _parse_response(content)
    assert len(result) == 1
    assert result[0]["deadline_date"] == "2025-12-31"


def test_parse_response_strips_markdown_fences():
    from app.services.deadlines import _parse_response

    content = '```json\n{"deadlines": [{"deadline_date": "2025-06-01", "description": "payment"}]}\n```'
    result = _parse_response(content)
    assert len(result) == 1


def test_parse_response_empty_deadlines():
    from app.services.deadlines import _parse_response

    result = _parse_response('{"deadlines": []}')
    assert result == []


def test_parse_response_invalid_json_returns_empty():
    from app.services.deadlines import _parse_response

    result = _parse_response("Not JSON at all.")
    assert result == []


def test_parse_response_missing_deadlines_key_returns_empty():
    from app.services.deadlines import _parse_response

    result = _parse_response('{"something": []}')
    assert result == []
