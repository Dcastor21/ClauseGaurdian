# FILE: ingestion.py | PURPOSE: Download a contract from Storage, parse PDF/DOCX, chunk text into LangChain Documents with page metadata | CONNECTS TO: called by pipeline.py (step 9); reads from Supabase Storage via db/supabase.py

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import io                                          # wrap raw bytes as a file-like object for PDF/DOCX parsers
import logging
from dataclasses import dataclass, field           # lightweight result container — no Pydantic overhead for internal data

from pypdf import PdfReader                        # PDF text extraction, page by page
from docx import Document as DocxDocument          # DOCX text extraction paragraph by paragraph

from langchain_core.documents import Document      # LangChain's document wrapper: page_content + metadata dict
from langchain_text_splitters import RecursiveCharacterTextSplitter  # splits text with tiktoken token counting

from app.db.supabase import get_service_client     # service client to download from Storage

logger = logging.getLogger(__name__)

# ── CONSTANTS ─────────────────────────────────────────────────────────────────
CHUNK_SIZE_TOKENS    = 1_000   # max tokens per chunk — fits inside any modern LLM context window
CHUNK_OVERLAP_TOKENS = 200     # overlap between adjacent chunks — preserves clause context at boundaries

# tiktoken encoding model name — used for accurate token counting.
# "cl100k_base" is the tokenizer for GPT-4, Claude, and most modern LLMs.
# Using this (rather than character count) ensures chunks don't exceed model limits.
TIKTOKEN_MODEL = "cl100k_base"

STORAGE_BUCKET = "contracts"   # must match the bucket name in supabase/schema.sql and contracts.py


# ── RESULT TYPE ───────────────────────────────────────────────────────────────
@dataclass
class IngestionResult:
    """
    WHY: A typed container for everything the pipeline needs from ingestion.
    Returning a dataclass (not just a list) lets pipeline.py log stats and
    make decisions based on page_count / char_count without re-parsing.

    Fields:
        chunks:      list of LangChain Documents — each has page_content (text) +
                     metadata {"page": int, "chunk_index": int, "source": str}
        page_count:  number of pages in the original document (1 for DOCX — not page-aware)
        char_count:  total character count of the raw extracted text (before chunking)
        chunk_count: number of chunks produced (len(chunks))
    """
    chunks: list[Document] = field(default_factory=list)
    page_count: int = 0
    char_count: int = 0

    @property
    def chunk_count(self) -> int:
        """Convenience accessor — avoids storing a redundant field."""
        return len(self.chunks)


# ── PUBLIC ENTRY POINT ────────────────────────────────────────────────────────
async def ingest_contract(
    contract_id: str,
    storage_path: str,
    file_ext: str,
) -> IngestionResult:
    """
    WHY: Orchestrates the full ingestion pipeline for one contract.
    Called by pipeline.py after a file is uploaded. Returns ready-to-use
    LangChain Documents that the extraction chain can iterate over.

    FLOW:
      1. Download file bytes from Supabase Storage
      2. Parse text out of the file (PDF page-by-page, or DOCX paragraph-by-paragraph)
      3. Wrap each page/section as a LangChain Document with page metadata
      4. Split all Documents into 1000-token chunks with 200-token overlap
      5. Attach chunk_index to each chunk's metadata
      6. Return IngestionResult with chunks + stats

    Args:
        contract_id:   UUID of the contract — used for logging and Helicone tags
        storage_path:  Supabase Storage path, e.g. "user_xxx/contract-uuid.pdf"
        file_ext:      "pdf" or "docx" — determines which parser to use

    Returns:
        IngestionResult: populated with chunks ready for the LangChain pipeline

    Raises:
        ValueError:   unsupported file_ext (shouldn't happen — validated at upload)
        RuntimeError: Storage download failed, or file is corrupted / unreadable
    """
    logger.info(f"[ingestion] Starting: contract_id={contract_id}, path={storage_path}")

    # Step 1 — Download
    file_bytes = await _download_from_storage(storage_path, contract_id)

    # Step 2 — Parse text with page metadata
    if file_ext == "pdf":
        page_texts = _extract_pdf_pages(file_bytes, contract_id)
    elif file_ext == "docx":
        page_texts = _extract_docx_sections(file_bytes, contract_id)
    else:
        # Guard: this should never be reached because upload validates MIME type
        raise ValueError(f"Unsupported file extension: {file_ext}")

    if not page_texts:
        raise RuntimeError(f"No text extracted from contract_id={contract_id}. File may be scanned/image-only.")

    total_chars = sum(len(t) for t in page_texts)
    logger.info(f"[ingestion] Extracted {len(page_texts)} pages, {total_chars} chars from contract_id={contract_id}")

    # Step 3 — Wrap each page as a LangChain Document with page metadata
    raw_docs = [
        Document(
            page_content=text,
            metadata={
                "page": page_num,
                "source": storage_path,
                "contract_id": contract_id,
            },
        )
        for page_num, text in enumerate(page_texts, start=1)
        if text.strip()
    ]

    if not raw_docs:
        raise RuntimeError(f"No text extracted from contract_id={contract_id}. File may be scanned/image-only.")

    # Step 4 — Chunk into 1000-token pieces with 200-token overlap
    chunks = _chunk_documents(raw_docs)

    # Step 5 — Add chunk_index to metadata so the pipeline can reference position
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = i

    logger.info(f"[ingestion] Produced {len(chunks)} chunks for contract_id={contract_id}")

    return IngestionResult(
        chunks=chunks,
        page_count=len(page_texts),
        char_count=total_chars,
    )


# ── PRIVATE: DOWNLOAD ─────────────────────────────────────────────────────────
async def _download_from_storage(storage_path: str, contract_id: str) -> bytes:
    """
    WHY: Retrieves the raw file bytes from Supabase Storage.
    Uses the service client because Storage download requires authentication
    (the bucket is private per schema.sql).

    FLOW:
      1. Call supabase.storage.from_("contracts").download(path)
      2. The response is raw bytes — no JSON parsing needed
      3. Raise RuntimeError if download fails so the caller can mark the contract "failed"

    Args:
        storage_path: Supabase Storage path, e.g. "user_xxx/contract-uuid.pdf"
        contract_id:  used only for error messages

    Returns:
        bytes: raw file content

    Raises:
        RuntimeError: if Supabase returns an error (bucket missing, path wrong, auth error)
    """
    client = get_service_client()

    try:
        # download() returns bytes directly in supabase-py v2
        # Failure here: Storage bucket not created, wrong path, or Supabase is down
        file_bytes: bytes = client.storage.from_(STORAGE_BUCKET).download(storage_path)
    except Exception as e:
        logger.error(f"[ingestion] Storage download failed for {storage_path}: {e}", exc_info=True)
        raise RuntimeError(
            f"Failed to download contract file for contract_id={contract_id}. "
            f"Check that the Storage bucket '{STORAGE_BUCKET}' exists and the path is correct."
        ) from e

    logger.debug(f"[ingestion] Downloaded {len(file_bytes)} bytes from {storage_path}")
    return file_bytes


# ── PRIVATE: PDF PARSER ───────────────────────────────────────────────────────
def _extract_pdf_pages(file_bytes: bytes, contract_id: str) -> list[str]:
    """
    WHY: Extracts text from each page of a PDF separately so we can attach
    accurate page numbers to each LangChain Document.

    FLOW:
      1. Wrap bytes in a BytesIO so PdfReader doesn't need a real file path
      2. Iterate pages — extract text from each
      3. Return a list where index 0 = page 1

    Limitation: pypdf cannot extract text from scanned/image-only PDFs.
    Those pages will return empty strings. We filter them in the caller.
    A future enhancement could add OCR (pytesseract) for image pages.

    Args:
        file_bytes:   raw PDF bytes
        contract_id:  for error logging

    Returns:
        list[str]: one string per page (may include empty strings for image pages)

    Raises:
        RuntimeError: if pypdf cannot read the file at all (corrupted, encrypted, etc.)
    """
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as e:
        logger.error(f"[ingestion] PdfReader failed for contract_id={contract_id}: {e}")
        raise RuntimeError(f"Could not read PDF (contract_id={contract_id}). The file may be corrupted or encrypted.") from e

    pages: list[str] = []
    for page_num, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            # A single bad page shouldn't abort the whole document — log and skip
            logger.warning(f"[ingestion] Failed to extract text from page {page_num} of contract_id={contract_id}: {e}")
            text = ""
        pages.append(text)

    return pages


# ── PRIVATE: DOCX PARSER ──────────────────────────────────────────────────────
def _extract_docx_sections(file_bytes: bytes, contract_id: str) -> list[str]:
    """
    WHY: Extracts text from a DOCX file. DOCX has no native page boundaries
    (pages are a rendering concept, not a data concept), so we group paragraphs
    into sections of roughly 3000 characters to approximate pages.

    FLOW:
      1. Wrap bytes in BytesIO and open with python-docx
      2. Collect all paragraph texts (skipping empty paragraphs)
      3. Bucket paragraphs into ~3000-char sections (approximate "pages")
      4. Return a list of section strings

    The 3000-char target per section is arbitrary — it produces sections
    roughly equivalent to one printed page. After chunking, sections are
    split further anyway, so exact size doesn't matter much.

    Args:
        file_bytes:   raw DOCX bytes
        contract_id:  for error logging

    Returns:
        list[str]: one string per section (typically 1–3 paragraphs each)

    Raises:
        RuntimeError: if python-docx cannot parse the file
    """
    try:
        doc = DocxDocument(io.BytesIO(file_bytes))
    except Exception as e:
        logger.error(f"[ingestion] DocxDocument failed for contract_id={contract_id}: {e}")
        raise RuntimeError(f"Could not read DOCX (contract_id={contract_id}). The file may be corrupted.") from e

    # Collect non-empty paragraphs
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

    if not paragraphs:
        return []

    # Group paragraphs into ~3000-char sections so metadata["page"] means something meaningful
    section_target = 3_000
    sections: list[str] = []
    current_section: list[str] = []
    current_len = 0

    for para in paragraphs:
        current_section.append(para)
        current_len += len(para)
        if current_len >= section_target:
            sections.append("\n\n".join(current_section))
            current_section = []
            current_len = 0

    # Flush any remaining paragraphs
    if current_section:
        sections.append("\n\n".join(current_section))

    return sections


# ── PRIVATE: CHUNKER ──────────────────────────────────────────────────────────
def _chunk_documents(docs: list[Document]) -> list[Document]:
    """
    WHY: LLMs have context window limits. A 30-page contract is too long to pass
    in a single prompt. We split it into 1000-token chunks with 200-token overlap.
    The overlap ensures clauses that span a chunk boundary are captured in full
    by at least one chunk.

    WHY RecursiveCharacterTextSplitter with tiktoken:
    - "Recursive" means it tries to split on paragraph boundaries first, then
      sentences, then words — preserving semantic units where possible.
    - tiktoken gives exact token counts for the model's actual tokenizer, so
      chunks reliably fit within the LLM's context window.
    - Alternative (character count) would be less accurate because CJK and
      legal symbols can be multi-byte but single tokens.

    FLOW:
      1. Build a splitter with tiktoken-based token counting
      2. Call split_documents() — preserves metadata from the input Documents
      3. Return the list of chunk Documents

    Args:
        docs: list of LangChain Documents (one per page/section)

    Returns:
        list[Document]: chunks, each with the same metadata as its source Document
                        plus chunk_index added by the caller
    """
    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name=TIKTOKEN_MODEL,
        chunk_size=CHUNK_SIZE_TOKENS,
        chunk_overlap=CHUNK_OVERLAP_TOKENS,
        # Separators: try paragraph breaks first, then newlines, then spaces, then chars.
        # Legal documents use double newlines to separate clauses — this preserves that.
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_documents(docs)
    return chunks


# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: ingest_contract() downloads a file from Storage, parses PDF/DOCX text
#          with page tracking, and returns 1000-token LangChain Documents ready for
#          the extraction pipeline. DOCX sections approximate pages at ~3000 chars.
# TO TEST: Call ingest_contract() directly with a real contract_id, storage_path, and ext.
#          Check result.chunk_count > 0 and result.chunks[0].metadata["page"] == 1.
#          Try a scanned PDF — should raise RuntimeError with a clear message.
# NEXT:    pipeline.py (step 9) iterates result.chunks and runs the LangChain extraction chain
