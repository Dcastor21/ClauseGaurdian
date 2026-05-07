import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from langchain_core.documents import Document

CONTRACT_ID = "22222222-2222-2222-2222-222222222222"
USER_ID = "user_test123"


def _chunk(text: str, page: int = 1, chunk_index: int = 0) -> Document:
    return Document(
        page_content=text,
        metadata={"page": page, "chunk_index": chunk_index, "contract_id": CONTRACT_ID},
    )


def _llm_resp(clauses: list[dict]) -> MagicMock:
    mock = MagicMock()
    mock.content = json.dumps({"clauses": clauses})
    return mock


@pytest.fixture
def mock_pipeline_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.services.pipeline.get_service_client", lambda: mock_client)
    return mock_client


@pytest.fixture
def mock_llm(monkeypatch):
    instance = MagicMock()
    instance.ainvoke = AsyncMock(return_value=_llm_resp([]))
    monkeypatch.setattr("app.services.pipeline.ChatOpenAI", MagicMock(return_value=instance))
    return instance


# --- run_extraction ---

async def test_extraction_returns_clause_objects(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.return_value = _llm_resp([
        {"clause_type": "indemnification", "raw_text": "The seller shall indemnify the buyer."}
    ])

    from app.services.pipeline import run_extraction

    result = await run_extraction([_chunk("text", page=3)], CONTRACT_ID, USER_ID)

    assert len(result) == 1
    assert result[0].clause_type == "indemnification"
    assert result[0].severity == "critical"
    assert result[0].raw_text == "The seller shall indemnify the buyer."
    assert result[0].page_ref == 3
    assert result[0].contract_id == UUID(CONTRACT_ID)


async def test_extraction_applies_correct_default_severities(mock_llm, mock_pipeline_supabase):
    from app.services.pipeline import CLAUSE_SEVERITIES, run_extraction

    for clause_type, expected_severity in CLAUSE_SEVERITIES.items():
        mock_llm.ainvoke.return_value = _llm_resp([
            {"clause_type": clause_type, "raw_text": f"Sample {clause_type} text."}
        ])
        result = await run_extraction([_chunk("text")], CONTRACT_ID, USER_ID)
        assert result[0].severity == expected_severity, f"{clause_type} should be {expected_severity}"


async def test_extraction_deduplicates_same_raw_text(mock_llm, mock_pipeline_supabase):
    same_text = "All IP created under this agreement is assigned to the company."
    mock_llm.ainvoke.return_value = _llm_resp([
        {"clause_type": "ip_assignment", "raw_text": same_text}
    ])

    from app.services.pipeline import run_extraction

    chunks = [_chunk(same_text, chunk_index=0), _chunk(same_text, chunk_index=1)]
    result = await run_extraction(chunks, CONTRACT_ID, USER_ID)

    assert len(result) == 1


async def test_extraction_different_texts_not_deduplicated(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.side_effect = [
        _llm_resp([{"clause_type": "termination", "raw_text": "Either party may terminate with 30 days notice."}]),
        _llm_resp([{"clause_type": "termination", "raw_text": "Termination requires written notice of 60 days."}]),
    ]

    from app.services.pipeline import run_extraction

    result = await run_extraction(
        [_chunk("chunk1", chunk_index=0), _chunk("chunk2", chunk_index=1)],
        CONTRACT_ID,
        USER_ID,
    )
    assert len(result) == 2


async def test_extraction_empty_chunks_returns_empty(mock_llm, mock_pipeline_supabase):
    from app.services.pipeline import run_extraction

    result = await run_extraction([], CONTRACT_ID, USER_ID)
    assert result == []
    mock_llm.ainvoke.assert_not_called()


async def test_extraction_no_clauses_skips_db_write(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.return_value = _llm_resp([])

    from app.services.pipeline import run_extraction

    result = await run_extraction([_chunk("irrelevant text")], CONTRACT_ID, USER_ID)
    assert result == []
    mock_pipeline_supabase.table.assert_not_called()


async def test_extraction_writes_all_clauses_to_db(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.return_value = _llm_resp([
        {"clause_type": "governing_law", "raw_text": "This agreement is governed by California law."}
    ])

    from app.services.pipeline import run_extraction

    await run_extraction([_chunk("text", page=5)], CONTRACT_ID, USER_ID)

    mock_pipeline_supabase.table.assert_called_with("clauses")
    insert_call = mock_pipeline_supabase.table.return_value.insert.call_args[0][0]
    assert len(insert_call) == 1
    assert insert_call[0]["clause_type"] == "governing_law"
    assert insert_call[0]["page_ref"] == 5


async def test_extraction_db_row_contains_contract_id(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.return_value = _llm_resp([
        {"clause_type": "confidentiality", "raw_text": "Confidential information shall not be disclosed."}
    ])

    from app.services.pipeline import run_extraction

    await run_extraction([_chunk("text")], CONTRACT_ID, USER_ID)

    insert_call = mock_pipeline_supabase.table.return_value.insert.call_args[0][0]
    assert insert_call[0]["contract_id"] == CONTRACT_ID


async def test_extraction_llm_error_propagates(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.side_effect = Exception("OpenRouter rate limit exceeded")

    from app.services.pipeline import run_extraction

    with pytest.raises(Exception, match="OpenRouter rate limit exceeded"):
        await run_extraction([_chunk("text")], CONTRACT_ID, USER_ID)


async def test_extraction_llm_error_does_not_write_to_db(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.side_effect = Exception("API error")

    from app.services.pipeline import run_extraction

    with pytest.raises(Exception):
        await run_extraction([_chunk("text")], CONTRACT_ID, USER_ID)

    mock_pipeline_supabase.table.assert_not_called()


async def test_extraction_skips_clauses_missing_type_or_text(mock_llm, mock_pipeline_supabase):
    mock_llm.ainvoke.return_value = _llm_resp([
        {"clause_type": "", "raw_text": "Some text."},
        {"clause_type": "termination", "raw_text": ""},
        {"clause_type": "governing_law", "raw_text": "Governed by New York law."},
    ])

    from app.services.pipeline import run_extraction

    result = await run_extraction([_chunk("text")], CONTRACT_ID, USER_ID)
    assert len(result) == 1
    assert result[0].clause_type == "governing_law"


# --- _parse_response ---

def test_parse_response_valid_json():
    from app.services.pipeline import _parse_response

    content = json.dumps({"clauses": [{"clause_type": "termination", "raw_text": "text"}]})
    result = _parse_response(content)
    assert len(result) == 1
    assert result[0]["clause_type"] == "termination"


def test_parse_response_strips_markdown_fences():
    from app.services.pipeline import _parse_response

    content = '```json\n{"clauses": [{"clause_type": "termination", "raw_text": "Either party may terminate."}]}\n```'
    result = _parse_response(content)
    assert len(result) == 1


def test_parse_response_strips_plain_fences():
    from app.services.pipeline import _parse_response

    content = '```\n{"clauses": []}\n```'
    result = _parse_response(content)
    assert result == []


def test_parse_response_invalid_json_returns_empty():
    from app.services.pipeline import _parse_response

    result = _parse_response("Not JSON at all.")
    assert result == []


def test_parse_response_missing_clauses_key_returns_empty():
    from app.services.pipeline import _parse_response

    result = _parse_response('{"something_else": []}')
    assert result == []


def test_parse_response_empty_clauses_list():
    from app.services.pipeline import _parse_response

    result = _parse_response('{"clauses": []}')
    assert result == []
