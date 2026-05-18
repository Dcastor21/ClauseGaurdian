import logging

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.db.models import ClauseCreate
from app.db.supabase import get_service_client
from app.services.pipeline import CLAUSE_SEVERITIES
from app.services.utils import parse_llm_json

logger = logging.getLogger(__name__)

SEVERITY_ORDER = ["critical", "high", "medium", "low"]

_SCORING_PROMPT = (
    "You are a contract risk analyst. Rate the legal risk severity of the following contract clause.\n"
    "Return ONLY valid JSON with no explanation or markdown:\n\n"
    '{"severity": "<critical|high|medium|low>", "reason": "<one sentence>"}\n\n'
    "Clause text:\n"
)


async def score_clauses(clauses: list[ClauseCreate], contract_id: str) -> list[ClauseCreate]:
    if not clauses:
        return []

    settings = get_settings()
    client = get_service_client()
    scored: list[ClauseCreate] = []

    for clause in clauses:
        if clause.clause_type in CLAUSE_SEVERITIES:
            scored.append(clause)
            continue

        # Unrecognized type — ask LLM to assign severity
        try:
            new_severity = await _llm_score_severity(
                clause.raw_text or "", contract_id, clause.clause_type, settings
            )
        except Exception as e:
            logger.warning(
                f"[scorer] LLM scoring failed for clause_type={clause.clause_type}, "
                f"contract={contract_id}: {e}. Keeping existing severity."
            )
            scored.append(clause)
            continue

        try:
            client.table("clauses").update({"severity": new_severity}).eq(
                "contract_id", contract_id
            ).eq("raw_text", clause.raw_text).execute()
        except Exception as e:
            logger.warning(f"[scorer] Failed to update severity in DB for clause_type={clause.clause_type}: {e}")

        scored.append(
            ClauseCreate(
                contract_id=clause.contract_id,
                clause_type=clause.clause_type,
                severity=new_severity,
                raw_text=clause.raw_text,
                page_ref=clause.page_ref,
            )
        )

    return scored


def compute_overall_risk(clauses: list[ClauseCreate]) -> str:
    if not clauses:
        return "low"
    severities = {c.severity for c in clauses}
    for level in SEVERITY_ORDER:
        if level in severities:
            return level
    return "low"


async def _llm_score_severity(
    raw_text: str, contract_id: str, clause_type: str, settings
) -> str:
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.HELICONE_BASE_URL,
        default_headers={
            "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}",
            "Helicone-Property-stage": "scoring",
            "Helicone-Property-contract_id": contract_id,
            "Helicone-Property-clause_type": clause_type,
        },
    )
    response = await llm.ainvoke([HumanMessage(content=_SCORING_PROMPT + raw_text)])
    return _parse_severity(response.content)


def _parse_severity(content: str) -> str:
    data = parse_llm_json(content)
    if isinstance(data, dict):
        severity = data.get("severity", "").lower().strip()
        if severity in SEVERITY_ORDER:
            return severity
    logger.warning(f"[scorer] Could not parse severity from LLM response: {content[:200]!r}")
    return "medium"
