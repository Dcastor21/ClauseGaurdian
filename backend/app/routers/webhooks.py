from fastapi import APIRouter, Request, HTTPException, Header
from svix.webhooks import Webhook, WebhookVerificationError

from app.config import get_settings
from app.db.supabase import get_service_client

router = APIRouter()


class _PayloadError(Exception):
    """Bad data in the webhook payload — ack to Clerk (no retry needed)."""


class _InfraError(Exception):
    """Downstream infrastructure failure — return 500 so Clerk retries."""


@router.post("/clerk", status_code=200)
async def handle_clerk_webhook(
    request: Request,
    svix_id: str | None = Header(None, alias="svix-id"),
    svix_timestamp: str | None = Header(None, alias="svix-timestamp"),
    svix_signature: str | None = Header(None, alias="svix-signature"),
) -> dict:
    if not all([svix_id, svix_timestamp, svix_signature]):
        raise HTTPException(status_code=400, detail="Missing required Svix webhook headers")

    raw_body = await request.body()  # must read before JSON parsing — Svix HMAC is over raw bytes

    settings = get_settings()
    wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
    try:
        event = wh.verify(raw_body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        })
    except WebhookVerificationError:
        raise HTTPException(status_code=401, detail="Webhook signature verification failed")

    event_type = event.get("type", "")
    data = event.get("data", {})

    try:
        if event_type == "user.created":
            await _handle_user_created(data)
        elif event_type == "user.updated":
            await _handle_user_updated(data)
        elif event_type == "user.deleted":
            await _handle_user_deleted(data)
    except _PayloadError:
        pass  # bad data — ack to Clerk, no retry
    except _InfraError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "ok"}


async def _handle_user_created(data: dict) -> None:
    clerk_user_id = data.get("id", "")
    primary_email_id = data.get("primary_email_address_id", "")
    email = ""
    for email_obj in data.get("email_addresses", []):
        if email_obj.get("id") == primary_email_id:
            email = email_obj.get("email_address", "")
            break

    if not clerk_user_id or not email:
        raise _PayloadError(f"user.created missing id or email (id={clerk_user_id!r})")

    try:
        get_service_client().table("users").upsert(
            {
                "clerk_user_id": clerk_user_id,
                "email": email,
                "plan": "free",
                "alert_preferences": {"email": True, "push": True},
            },
            on_conflict="clerk_user_id",
        ).execute()
    except Exception as e:
        raise _InfraError(f"DB write failed for user.created clerk_user_id={clerk_user_id}: {e}") from e


async def _handle_user_updated(data: dict) -> None:
    clerk_user_id = data.get("id", "")
    if not clerk_user_id:
        raise _PayloadError("user.updated missing id")

    primary_email_id = data.get("primary_email_address_id", "")
    email = ""
    for email_obj in data.get("email_addresses", []):
        if email_obj.get("id") == primary_email_id:
            email = email_obj.get("email_address", "")
            break

    if not email:
        raise _PayloadError(f"user.updated missing email for clerk_user_id={clerk_user_id!r}")

    try:
        get_service_client().table("users").update({"email": email}).eq("clerk_user_id", clerk_user_id).execute()
    except Exception as e:
        raise _InfraError(f"DB write failed for user.updated clerk_user_id={clerk_user_id}: {e}") from e


async def _handle_user_deleted(data: dict) -> None:
    clerk_user_id = data.get("id", "")
    if not clerk_user_id:
        raise _PayloadError("user.deleted missing id")

    try:
        get_service_client().table("users").delete().eq("clerk_user_id", clerk_user_id).execute()
    except Exception as e:
        raise _InfraError(f"DB write failed for user.deleted clerk_user_id={clerk_user_id}: {e}") from e
