import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.db.supabase import get_service_client
from app.services.alerts import send_email_alert

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()

# Maps alert_type value in the deadlines table to the days-before threshold
ALERT_WINDOWS: dict[str, int] = {
    "30-day": 30,
    "14-day": 14,
    "7-day": 7,
    "1-day": 1,
}


def start_scheduler() -> None:
    _scheduler.add_job(check_deadlines, "interval", hours=1, id="check_deadlines")
    _scheduler.start()
    logger.info("[scheduler] Started — hourly deadline check active")


def shutdown_scheduler() -> None:
    _scheduler.shutdown(wait=False)
    logger.info("[scheduler] Shut down")


async def check_deadlines() -> None:
    client = get_service_client()
    now = datetime.now(timezone.utc)
    logger.info(f"[scheduler] Running deadline check at {now.isoformat()}")

    for alert_type, days in ALERT_WINDOWS.items():
        window_cutoff = (now + timedelta(days=days)).isoformat()

        try:
            response = (
                client.table("deadlines")
                .select("id, deadline_date, contract_id, contracts(clerk_user_id, name)")
                .eq("alert_type", alert_type)
                .eq("alert_status", "pending")
                .lte("deadline_date", window_cutoff)
                .gte("deadline_date", now.isoformat())
                .execute()
            )
        except Exception as e:
            logger.error(f"[scheduler] Query failed for window={alert_type}: {e}")
            continue

        for row in response.data:
            await _process_deadline_alert(client, row, alert_type, days)


async def _process_deadline_alert(
    client,
    row: dict,
    alert_type: str,
    days: int,
) -> None:
    deadline_id = row["id"]
    contract_id = row["contract_id"]
    deadline_date = row["deadline_date"][:10]
    contract = row.get("contracts") or {}
    clerk_user_id = contract.get("clerk_user_id")
    contract_name = contract.get("name", "your contract")

    if not clerk_user_id:
        logger.warning(f"[scheduler] No user for deadline={deadline_id} — skipping")
        return

    try:
        user_resp = (
            client.table("users")
            .select("email, alert_preferences")
            .eq("clerk_user_id", clerk_user_id)
            .single()
            .execute()
        )
        user = user_resp.data
    except Exception as e:
        logger.error(f"[scheduler] Failed to fetch user={clerk_user_id}: {e}")
        return

    if not user:
        return

    prefs = user.get("alert_preferences") or {}
    if not prefs.get("email", True):
        logger.info(f"[scheduler] Email disabled for user={clerk_user_id}, skipping deadline={deadline_id}")
        return

    subject = f"Deadline reminder ({days} days): {contract_name}"
    body_html = (
        f"<p>Your contract <strong>{contract_name}</strong> has a deadline on "
        f"<strong>{deadline_date}</strong>.</p>"
        f"<p>This is your {days}-day reminder. Please review the contract and take any "
        f"necessary action before the deadline.</p>"
        f"<p><em>ClauseGuardian — contract monitoring made simple</em></p>"
    )

    sent = await send_email_alert(
        to_email=user["email"],
        subject=subject,
        body_html=body_html,
        contract_id=contract_id,
        clerk_user_id=clerk_user_id,
    )

    new_status = "sent" if sent else "failed"
    try:
        client.table("deadlines").update({"alert_status": new_status}).eq("id", deadline_id).execute()
    except Exception as e:
        logger.error(f"[scheduler] Failed to update deadline status for {deadline_id}: {e}")
