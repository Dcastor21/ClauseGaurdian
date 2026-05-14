from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_service_client
from app.middleware.clerk_auth import get_current_user_id

router = APIRouter()

FREE_PLAN_MONTHLY_LIMIT = 20


class AlertPrefsUpdate(BaseModel):
    email: bool | None = None
    push: bool | None = None
    windows: list[int] | None = None


@router.get("/me")
async def get_me(clerk_user_id: str = Depends(get_current_user_id)) -> dict:
    client = get_service_client()
    resp = (
        client.table("users")
        .select("*")
        .eq("clerk_user_id", clerk_user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="User not found")

    month_start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    count_resp = (
        client.table("contracts")
        .select("id", count="exact")
        .eq("clerk_user_id", clerk_user_id)
        .gte("created_at", month_start.isoformat())
        .execute()
    )

    data = dict(resp.data)
    data["contracts_this_month"] = count_resp.count or 0
    data["monthly_limit"] = FREE_PLAN_MONTHLY_LIMIT
    return data


@router.patch("/me/preferences")
async def update_preferences(
    body: AlertPrefsUpdate,
    clerk_user_id: str = Depends(get_current_user_id),
) -> dict:
    client = get_service_client()
    resp = (
        client.table("users")
        .select("alert_preferences")
        .eq("clerk_user_id", clerk_user_id)
        .single()
        .execute()
    )
    existing: dict = (resp.data or {}).get("alert_preferences") or {}
    merged = {**existing, **body.model_dump(exclude_none=True)}

    client.table("users").update({"alert_preferences": merged}).eq(
        "clerk_user_id", clerk_user_id
    ).execute()
    return {"alert_preferences": merged}
