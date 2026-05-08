import json
import logging
from datetime import datetime

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.db.supabase import get_service_client

logger = logging.getLogger(__name__)

# Four alert windows created per extracted deadline date
ALERT_WINDOWS = ["30-day", "14-day", "7-day", "1-day"]

_DEADLINE_PROMPT = (
    "You are a contract analyst. Review the contract text and extract any specific dates, "
    "deadlines, renewal dates, or payment due dates mentioned.\n"
    "Return ONLY valid JSON with no explanation or markdown:\n\n"
    '{"deadlines": [{"deadline_date": "YYYY-MM-DD", "description": "<brief label>"}]}\n\n'
    'If no dates are found, return: {"deadlines": []}\n\n'
    "Contract text:\n"
)


async def extract_deadlines(chunks: list[Document], contract_id: str) -> None:
    if not chunks:
        return

    settings = get_settings()
    llm = _build_llm(contract_id, settings)
    client = get_service_client()
    seen_dates: set[str] = set()

    for chunk in chunks:
        try:
            extracted = await _extract_from_chunk(llm, chunk.page_content)
        except Exception as e:
            logger.warning(f"[deadlines] LLM error on chunk for contract={contract_id}: {e}")
            continue

        for item in extracted:
            date_str = item.get("deadline_date", "").strip()
            if not date_str or date_str in seen_dates:
                continue

            try:
                datetime.fromisoformat(date_str)
            except ValueError:
                logger.warning(f"[deadlines] Skipping invalid date {date_str!r} for contract={contract_id}")
                continue

            seen_dates.add(date_str)
            _write_deadline_rows(client, contract_id, date_str)

    logger.info(f"[deadlines] Extracted {len(seen_dates)} unique deadline(s) for contract={contract_id}")


def _write_deadline_rows(client, contract_id: str, deadline_date: str) -> None:
    rows = [
        {
            "contract_id": contract_id,
            "deadline_date": deadline_date,
            "alert_window": window,
            "alert_status": "pending",
        }
        for window in ALERT_WINDOWS
    ]
    try:
        client.table("deadlines").insert(rows).execute()
    except Exception as e:
        logger.error(f"[deadlines] Failed to write rows for date={deadline_date}, contract={contract_id}: {e}")


async def _extract_from_chunk(llm: ChatOpenAI, text: str) -> list[dict]:
    response = await llm.ainvoke([HumanMessage(content=_DEADLINE_PROMPT + text)])
    return _parse_response(response.content)


def _parse_response(content: str) -> list[dict]:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1]).strip()
    try:
        data = json.loads(content)
        return data.get("deadlines", []) if isinstance(data, dict) else []
    except json.JSONDecodeError:
        logger.warning(f"[deadlines] Failed to parse LLM response: {content[:200]!r}")
        return []


def _build_llm(contract_id: str, settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.LLM_MODEL,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.HELICONE_BASE_URL,
        default_headers={
            "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}",
            "Helicone-Property-stage": "deadline_extraction",
            "Helicone-Property-contract_id": contract_id,
        },
    )
