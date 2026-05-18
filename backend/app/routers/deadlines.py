import logging

from fastapi import APIRouter, Depends, HTTPException

from app.db.models import DeadlineRead
from app.db.supabase import get_service_client
from app.middleware.clerk_auth import get_current_user_id
from app.routers.deps import verify_contract_owner

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=list[DeadlineRead])
async def list_deadlines(
    contract_id: str,
    clerk_user_id: str = Depends(get_current_user_id),
) -> list[DeadlineRead]:
    verify_contract_owner(contract_id, clerk_user_id)
    client = get_service_client()
    try:
        resp = (
            client.table("deadlines")
            .select("*")
            .eq("contract_id", contract_id)
            .order("deadline_date")
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to list deadlines for contract={contract_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to retrieve deadlines.")
    return [DeadlineRead.model_validate(row) for row in resp.data]
