import json
import logging

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.db.models import ClauseCreate
from app.db.supabase import get_service_client

logger = logging.getLogger(__name__)

_SUMMARY_PROMPT = (
    "You are a contract assistant helping non-lawyers understand their contracts.\n"
    "Read the following contract clause and provide:\n"
    "1. A plain-English summary (2-3 sentences): what this clause means, why it matters, "
    "and what could happen if ignored. Use no legal jargon.\n"
    "2. A recommended action (1 sentence): one specific, concrete step the user should take. "
    "Do not say 'consult a lawyer' — tell them exactly what to do and by when if a deadline applies.\n\n"
    "Return ONLY valid JSON with no explanation or markdown:\n"
    '{"summary": "...", "recommended_action": "..."}\n\n'
    "Contract clause:\n"
)


async def summarize_clauses(
    clauses: list[ClauseCreate],
    contract_id: str,
    clerk_user_id: str,
) -> None:
    if not clauses:
        return

    settings = get_settings()
    client = get_service_client()

    for clause in clauses:
        try:
            summary, recommended_action = await _llm_summarize(
                clause.raw_text or "",
                contract_id,
                clause.clause_type,
                settings,
            )
        except Exception as e:
            logger.error(
                f"[summarizer] Failed for clause_type={clause.clause_type}, "
                f"contract={contract_id}: {e}"
            )
            continue

        try:
            client.table("clauses").update(
                {"summary": summary, "recommended_action": recommended_action}
            ).eq("contract_id", contract_id).eq("raw_text", clause.raw_text).execute()
        except Exception as e:
            logger.error(
                f"[summarizer] DB write failed for clause_type={clause.clause_type}, "
                f"contract={contract_id}: {e}"
            )


async def _llm_summarize(
    raw_text: str,
    contract_id: str,
    clause_type: str,
    settings,
) -> tuple[str, str]:
    llm = ChatOpenAI(
        model="anthropic/claude-3-haiku",
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base="https://oai.helicone.ai/v1",
        default_headers={
            "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}",
            "Helicone-Property-stage": "summarization",
            "Helicone-Property-contract_id": contract_id,
            "Helicone-Property-clause_type": clause_type,
        },
    )
    response = await llm.ainvoke([HumanMessage(content=_SUMMARY_PROMPT + raw_text)])
    return _parse_summary(response.content)


def _parse_summary(content: str) -> tuple[str, str]:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1]).strip()
    try:
        data = json.loads(content)
        summary = data.get("summary", "").strip()
        recommended_action = data.get("recommended_action", "").strip()
        if summary and recommended_action:
            return summary, recommended_action
    except json.JSONDecodeError:
        pass
    raise ValueError(f"Could not parse summary from LLM response: {content[:100]!r}")
