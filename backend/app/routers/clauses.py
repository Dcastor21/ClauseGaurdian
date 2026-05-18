import logging

from fastapi import APIRouter, Depends, HTTPException

from app.db.models import ClauseRead
from app.db.supabase import get_service_client
from app.middleware.clerk_auth import get_current_user_id
from app.routers.deps import verify_contract_owner

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=list[ClauseRead])
async def list_clauses(
    contract_id: str,
    clerk_user_id: str = Depends(get_current_user_id),
) -> list[ClauseRead]:
    verify_contract_owner(contract_id, clerk_user_id)
    client = get_service_client()
    try:
        resp = client.table("clauses").select("*").eq("contract_id", contract_id).execute()
    except Exception as e:
        logger.error(f"Failed to list clauses for contract={contract_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to retrieve clauses.")
    return [ClauseRead.model_validate(row) for row in resp.data]
