import hashlib
import json
import logging
from uuid import UUID

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.db.models import ClauseCreate
from app.db.supabase import get_service_client

logger = logging.getLogger(__name__)

CLAUSE_SEVERITIES: dict[str, str] = {
    "indemnification": "critical",
    "ip_assignment": "critical",
    "auto_renewal": "high",
    "liability_cap": "high",
    "termination": "medium",
    "confidentiality": "medium",
    "payment_terms": "medium",
    "governing_law": "low",
}

_KNOWN_TYPES = ", ".join(CLAUSE_SEVERITIES.keys())

_EXTRACTION_PROMPT_PREFIX = (
    f"You are a contract analyst. Review the contract text below and identify any of these "
    f"clause types: {_KNOWN_TYPES}.\n\n"
    "For each clause you find, extract the EXACT verbatim text as it appears in the document.\n"
    'Return ONLY valid JSON with no explanation or markdown:\n\n'
    '{"clauses": [{"clause_type": "<type from list>", "raw_text": "<verbatim text from document>"}]}\n\n'
    'If no relevant clauses are found, return: {"clauses": []}\n\n'
    "Contract text:\n"
)


async def run_extraction(
    chunks: list[Document],
    contract_id: str,
    clerk_user_id: str,
) -> list[ClauseCreate]:
    if not chunks:
        return []

    settings = get_settings()
    llm = _build_llm(contract_id, settings)

    seen_hashes: set[str] = set()
    all_clauses: list[ClauseCreate] = []

    for chunk in chunks:
        chunk_index = chunk.metadata.get("chunk_index", "?")
        page = chunk.metadata.get("page", 1)

        try:
            raw_clauses = await _extract_from_chunk(llm, chunk.page_content)
        except Exception as e:
            logger.error(
                f"[extraction] LLM error on chunk={chunk_index}, contract={contract_id}: {e}"
            )
            raise

        for raw in raw_clauses:
            clause_type = raw.get("clause_type", "").strip()
            raw_text = raw.get("raw_text", "").strip()

            if not clause_type or not raw_text:
                continue

            text_hash = hashlib.sha256(raw_text.encode()).hexdigest()
            if text_hash in seen_hashes:
                continue
            seen_hashes.add(text_hash)

            all_clauses.append(
                ClauseCreate(
                    contract_id=UUID(contract_id),
                    clause_type=clause_type,
                    severity=CLAUSE_SEVERITIES.get(clause_type, "medium"),
                    raw_text=raw_text,
                    page_ref=page,
                )
            )

    if all_clauses:
        _write_clauses(all_clauses)
        logger.info(f"[extraction] Wrote {len(all_clauses)} clauses for contract={contract_id}")
    else:
        logger.info(f"[extraction] No clauses found in contract={contract_id}")

    return all_clauses


def _build_llm(contract_id: str, settings) -> ChatOpenAI:
    return ChatOpenAI(
        model="anthropic/claude-3-haiku",
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base="https://oai.helicone.ai/v1",
        default_headers={
            "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}",
            "Helicone-Property-stage": "extraction",
            "Helicone-Property-contract_id": contract_id,
        },
    )


async def _extract_from_chunk(llm: ChatOpenAI, text: str) -> list[dict]:
    prompt = _EXTRACTION_PROMPT_PREFIX + text
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return _parse_response(response.content)


def _parse_response(content: str) -> list[dict]:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1]).strip()
    try:
        data = json.loads(content)
        return data.get("clauses", []) if isinstance(data, dict) else []
    except json.JSONDecodeError:
        logger.warning(f"[extraction] Failed to parse LLM response as JSON: {content[:200]!r}")
        return []


def _write_clauses(clauses: list[ClauseCreate]) -> None:
    client = get_service_client()
    rows = [
        {
            "contract_id": str(clause.contract_id),
            "clause_type": clause.clause_type,
            "severity": clause.severity,
            "raw_text": clause.raw_text,
            "page_ref": clause.page_ref,
        }
        for clause in clauses
    ]
    client.table("clauses").insert(rows).execute()
