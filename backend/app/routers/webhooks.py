# FILE: webhooks.py | PURPOSE: Handle Clerk lifecycle webhook events — keep users table in sync | CONNECTS TO: main.py (router mount), db/supabase.py (service client), db/models.py (UserCreate)

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import logging
from fastapi import APIRouter, Request, HTTPException, Header  # Header extracts individual HTTP headers
from svix.webhooks import Webhook, WebhookVerificationError    # official svix library for Clerk webhook verification
from app.config import settings                                # env vars (CLERK_WEBHOOK_SECRET)
from app.db.supabase import get_service_client                 # bypasses RLS — required for webhook writes

logger = logging.getLogger(__name__)
router = APIRouter()


# ── WEBHOOK RECEIVER ─────────────────────────────────────────────────────────
@router.post("/clerk", status_code=200)
async def handle_clerk_webhook(
    request: Request,
    svix_id: str | None = Header(None, alias="svix-id"),
    svix_timestamp: str | None = Header(None, alias="svix-timestamp"),
    svix_signature: str | None = Header(None, alias="svix-signature"),
) -> dict:
    """
    WHY: Clerk sends events to this endpoint when users sign up, update their profile,
    or delete their account. Our users table must mirror Clerk's user state — this is
    how rows get created and deleted without us polling Clerk's API on every request.

    IMPORTANT SETUP:
      1. Go to Clerk Dashboard → Webhooks → Add Endpoint
      2. Set endpoint URL to: https://your-api.onrender.com/webhooks/clerk
      3. Subscribe to: user.created, user.updated, user.deleted
      4. Copy the Signing Secret → set as CLERK_WEBHOOK_SECRET in .env

    FLOW:
      1. Verify all three Svix signature headers are present
      2. Read the raw request body as bytes (must NOT parse JSON first — breaks signature)
      3. Use svix.Webhook to verify the HMAC signature against CLERK_WEBHOOK_SECRET
      4. Route to the appropriate private handler based on event type
      5. Return {"status": "ok"} — Clerk marks delivery successful on any 2xx response

    Args:
        request:        raw FastAPI request — needed to read bytes before any parsing
        svix_id:        Svix message ID header (svix-id)
        svix_timestamp: Svix timestamp header (svix-timestamp) — prevents replay attacks
        svix_signature: Svix HMAC signature header (svix-signature)

    Returns:
        dict: {"status": "ok"} — Clerk retries if we return non-2xx

    Raises:
        HTTPException 400: missing required Svix headers
        HTTPException 401: HMAC signature verification failed (possible spoofing)
    """
    # Step 1: All three Svix headers must be present — Clerk always sends all three
    if not all([svix_id, svix_timestamp, svix_signature]):
        logger.warning("Clerk webhook received without Svix headers — rejecting")
        raise HTTPException(
            status_code=400,
            detail="Missing required Svix webhook headers (svix-id, svix-timestamp, svix-signature)",
        )

    # Step 2: Read raw body bytes BEFORE any JSON parsing
    # Svix verifies the HMAC against the exact raw bytes Clerk sent.
    # If we let FastAPI parse JSON first (e.g., use `body: dict = Body()`), the
    # byte representation changes and the signature check will always fail.
    raw_body: bytes = await request.body()

    # Step 3: Verify the webhook signature using the svix library
    # If CLERK_WEBHOOK_SECRET is wrong or the payload was tampered with,
    # WebhookVerificationError is raised.
    # Find CLERK_WEBHOOK_SECRET at: Clerk Dashboard → Webhooks → your endpoint → Signing Secret
    wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
    try:
        event: dict = wh.verify(
            raw_body,
            {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
    except WebhookVerificationError:
        # This fires for: wrong secret, replayed requests (timestamp too old), tampered body
        logger.warning(
            "Clerk webhook signature verification failed — "
            "check CLERK_WEBHOOK_SECRET or investigate for spoofing"
        )
        raise HTTPException(status_code=401, detail="Webhook signature verification failed")

    event_type: str = event.get("type", "")
    data: dict = event.get("data", {})

    logger.info(f"Received Clerk webhook event: type={event_type}")

    # Step 4: Route to handler
    if event_type == "user.created":
        await _handle_user_created(data)
    elif event_type == "user.updated":
        await _handle_user_updated(data)
    elif event_type == "user.deleted":
        await _handle_user_deleted(data)
    else:
        # Unknown event types are not errors — Clerk may introduce new event types.
        # Log them so we know to handle them if they become relevant.
        logger.info(f"Unhandled Clerk webhook event type: {event_type} — ignoring")

    return {"status": "ok"}


# ── EVENT HANDLERS ─────────────────────────────────────────────────────────────

async def _handle_user_created(data: dict) -> None:
    """
    WHY: Creates the users row when someone signs up via Clerk.
    Without this, the user has no row in our DB and cannot create contracts
    (the FK constraint on contracts.clerk_user_id would reject the insert).

    FLOW:
      1. Extract clerk_user_id (data["id"]) and primary email from the Clerk payload
      2. Clerk sends emails as a list — find the one whose id matches primary_email_address_id
      3. Insert into users table using the service client (bypasses RLS)

    Args:
        data: Clerk user.created event data — see Clerk API docs for full shape

    Raises:
        Logs error and returns without raising — Clerk will retry on 5xx,
        but we return 200 here to avoid retry loops for data issues
    """
    clerk_user_id: str = data.get("id", "")

    # Clerk sends a list of email objects; find the primary one
    # Structure: [{"id": "idn_xxx", "email_address": "user@example.com", ...}]
    primary_email_id: str = data.get("primary_email_address_id", "")
    email: str = ""
    for email_obj in data.get("email_addresses", []):
        if email_obj.get("id") == primary_email_id:
            email = email_obj.get("email_address", "")
            break

    if not clerk_user_id or not email:
        logger.error(f"user.created event missing id or email. data keys: {list(data.keys())}")
        return  # return 200 to Clerk anyway — retrying won't fix a malformed payload

    client = get_service_client()

    # Upsert rather than insert: handles the edge case where a previous webhook delivery
    # was received but the 200 response was lost (Clerk retried, would fail with duplicate key).
    # on_conflict="clerk_user_id" means: if the row exists, update email/plan to match.
    # Failure here: Supabase is down, table doesn't exist, or schema mismatch.
    response = (
        client.table("users")
        .upsert(
            {
                "clerk_user_id": clerk_user_id,
                "email": email,
                "plan": "free",
                "alert_preferences": {"email": True, "push": True},
            },
            on_conflict="clerk_user_id",
        )
        .execute()
    )

    if response.data:
        logger.info(f"Upserted users row for clerk_user_id={clerk_user_id}")
    else:
        logger.error(f"Failed to upsert users row. Response: {response}")


async def _handle_user_updated(data: dict) -> None:
    """
    WHY: Keeps our users row in sync when the user changes their primary email in Clerk.
    Without this, alert emails would go to the old address.

    FLOW:
      1. Extract clerk_user_id and new primary email from the Clerk payload
      2. Build an update dict with only the fields that changed
      3. PATCH the users row via service client

    Args:
        data: Clerk user.updated event data
    """
    clerk_user_id: str = data.get("id", "")
    if not clerk_user_id:
        logger.error("user.updated event missing id")
        return

    primary_email_id: str = data.get("primary_email_address_id", "")
    email: str = ""
    for email_obj in data.get("email_addresses", []):
        if email_obj.get("id") == primary_email_id:
            email = email_obj.get("email_address", "")
            break

    update_payload: dict = {}
    if email:
        update_payload["email"] = email

    if not update_payload:
        logger.debug(f"user.updated for {clerk_user_id} — no tracked fields changed")
        return

    client = get_service_client()
    # Failure here: user row doesn't exist (created webhook was missed) — acceptable,
    # the row will be created on the next sign-in via session sync (future feature).
    client.table("users").update(update_payload).eq("clerk_user_id", clerk_user_id).execute()
    logger.info(f"Updated users row for clerk_user_id={clerk_user_id}: {list(update_payload.keys())}")


async def _handle_user_deleted(data: dict) -> None:
    """
    WHY: Removes the users row when a Clerk account is deleted.
    The FK cascade in schema.sql (ON DELETE CASCADE on contracts.clerk_user_id)
    will automatically delete the user's contracts, clauses, and deadlines.
    alert_logs are preserved (no FK, per the append-only audit trail design).

    FLOW:
      1. Extract clerk_user_id from the payload
      2. Delete the users row — cascades handle the rest

    Args:
        data: Clerk user.deleted event data
    """
    clerk_user_id: str = data.get("id", "")
    if not clerk_user_id:
        logger.error("user.deleted event missing id")
        return

    client = get_service_client()
    # Cascade: contracts → clauses → deadlines are all deleted by Postgres.
    # alert_logs survive (no FK constraint) — intentional audit trail preservation.
    # Failure here: Supabase is down — acceptable, we log and move on.
    client.table("users").delete().eq("clerk_user_id", clerk_user_id).execute()
    logger.info(f"Deleted users row and cascaded data for clerk_user_id={clerk_user_id}")


# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: POST /webhooks/clerk handles user.created, user.updated, user.deleted.
#          Svix signature verification prevents spoofed events.
# TO TEST: Use the Clerk Dashboard "Send Test Event" button against your local
#          endpoint (use `ngrok http 8000` to expose localhost). Check Supabase
#          Table Editor after each event — users row should appear/update/delete.
# NEXT:    routers/contracts.py — file upload endpoint with Clerk JWT auth gate
