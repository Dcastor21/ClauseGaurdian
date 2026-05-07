import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.db.supabase import get_service_client

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"
_FROM_ADDRESS = "alerts@clauseguardian.com"


async def send_email_alert(
    to_email: str,
    subject: str,
    body_html: str,
    contract_id: str | None,
    clerk_user_id: str,
) -> bool:
    settings = get_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                _RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": _FROM_ADDRESS,
                    "to": [to_email],
                    "subject": subject,
                    "html": body_html,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
        _log_alert(get_service_client(), clerk_user_id, contract_id, "email", subject)
        return True
    except Exception as e:
        logger.error(f"[alerts] Email send failed to {to_email}: {e}")
        return False


async def send_push_alert(
    title: str,
    message: str,
    contract_id: str | None,
    clerk_user_id: str,
) -> bool:
    settings = get_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://ntfy.sh/{settings.NTFY_TOPIC}",
                content=message.encode(),
                headers={"Title": title, "Priority": "high"},
                timeout=10.0,
            )
            resp.raise_for_status()
        _log_alert(get_service_client(), clerk_user_id, contract_id, "push", f"{title}: {message}")
        return True
    except Exception as e:
        logger.error(f"[alerts] Push alert failed: {e}")
        return False


def _log_alert(
    client,
    clerk_user_id: str,
    contract_id: str | None,
    channel: str,
    message: str,
) -> None:
    try:
        row: dict = {
            "clerk_user_id": clerk_user_id,
            "channel": channel,
            "message": message[:500],
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        if contract_id:
            row["contract_id"] = contract_id
        client.table("alert_logs").insert(row).execute()
    except Exception as e:
        logger.warning(f"[alerts] Failed to write alert log: {e}")
