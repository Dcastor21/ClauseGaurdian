import io
from unittest.mock import AsyncMock

import pytest


def _make_docx_bytes(text: str = "This is a test indemnification clause.") -> bytes:
    from docx import Document

    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _make_blank_pdf_bytes() -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture
def mock_download(monkeypatch):
    mock = AsyncMock(return_value=b"")
    monkeypatch.setattr("app.services.ingestion._download_from_storage", mock)
    return mock


# --- docx ingestion ---

async def test_ingest_docx_produces_chunks(mock_download):
    long_text = "This is a test indemnification clause that grants the seller full rights. " * 50
    mock_download.return_value = _make_docx_bytes(long_text)

    from app.services.ingestion import ingest_contract

    result = await ingest_contract("contract-123", "user/contract-123.docx", "docx")
    assert result.chunk_count > 0
    assert result.page_count > 0
    assert result.char_count > 0


async def test_ingest_docx_chunks_have_page_and_chunk_index(mock_download):
    mock_download.return_value = _make_docx_bytes("Test clause content for metadata verification.")

    from app.services.ingestion import ingest_contract

    result = await ingest_contract("contract-123", "user/contract-123.docx", "docx")
    assert result.chunk_count > 0
    for chunk in result.chunks:
        assert "page" in chunk.metadata
        assert "chunk_index" in chunk.metadata
        assert chunk.metadata["contract_id"] == "contract-123"


async def test_ingest_docx_chunk_indices_are_sequential(mock_download):
    long_text = "Indemnification clause with substantial content. " * 200
    mock_download.return_value = _make_docx_bytes(long_text)

    from app.services.ingestion import ingest_contract

    result = await ingest_contract("contract-123", "user/contract-123.docx", "docx")
    indices = [c.metadata["chunk_index"] for c in result.chunks]
    assert indices == list(range(len(result.chunks)))


# --- pdf ingestion ---

async def test_ingest_blank_pdf_raises_runtime_error(mock_download):
    mock_download.return_value = _make_blank_pdf_bytes()

    from app.services.ingestion import ingest_contract

    with pytest.raises(RuntimeError, match="No text extracted"):
        await ingest_contract("contract-123", "user/contract-123.pdf", "pdf")


# --- error cases ---

async def test_ingest_unsupported_extension_raises_value_error(mock_download):
    mock_download.return_value = b"some bytes"

    from app.services.ingestion import ingest_contract

    with pytest.raises(ValueError, match="Unsupported file extension"):
        await ingest_contract("contract-123", "user/contract-123.txt", "txt")


async def test_ingest_download_failure_propagates(monkeypatch):
    async def fail_download(*args, **kwargs):
        raise RuntimeError("Storage unreachable")

    monkeypatch.setattr("app.services.ingestion._download_from_storage", fail_download)

    from app.services.ingestion import ingest_contract

    with pytest.raises(RuntimeError, match="Storage unreachable"):
        await ingest_contract("contract-123", "user/contract-123.pdf", "pdf")


async def test_ingest_result_chunk_count_matches_chunks_length(mock_download):
    mock_download.return_value = _make_docx_bytes("Short clause.")

    from app.services.ingestion import ingest_contract

    result = await ingest_contract("contract-123", "user/contract-123.docx", "docx")
    assert result.chunk_count == len(result.chunks)
