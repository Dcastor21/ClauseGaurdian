import argparse
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import httpx

from app.config import get_settings
from app.db.supabase import get_service_client

CLERK_API_URL = "https://api.clerk.com/v1/users"
PAGE_LIMIT = 100


def get_primary_email(user: dict[str, Any]) -> str | None:
    # Clerk user objects may include primary_email_address_id and an email_addresses list.
    primary_id = user.get("primary_email_address_id")
    for email_obj in user.get("email_addresses", []):
        if primary_id and email_obj.get("id") == primary_id:
            return email_obj.get("email_address")
    for email_obj in user.get("email_addresses", []):
        if email_obj.get("email_address"):
            return email_obj["email_address"]
    return user.get("email")


def normalize_user_payload(user: dict[str, Any]) -> dict[str, Any] | None:
    clerk_user_id = user.get("id")
    email = get_primary_email(user)
    if not clerk_user_id or not email:
        return None

    return {
        "clerk_user_id": clerk_user_id,
        "email": email,
        "plan": "free",
        "alert_preferences": {"email": True, "push": True},
    }


def fetch_clerk_users(client: httpx.Client, cursor: str | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {"limit": PAGE_LIMIT}
    if cursor:
        params["cursor"] = cursor

    resp = client.get(CLERK_API_URL, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_next_cursor(payload: dict[str, Any]) -> str | None:
    return (
        payload.get("next_cursor")
        or payload.get("next_page_cursor")
        or payload.get("after")
        or payload.get("cursor")
        or payload.get("meta", {}).get("next_cursor")
        or payload.get("meta", {}).get("next_page_cursor")
    )


def sync_users(dry_run: bool = False) -> int:
    settings = get_settings()
    svc = get_service_client()

    headers = {
        "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
        "Accept": "application/json",
    }

    clerk_client = httpx.Client(headers=headers)
    cursor: str | None = None
    total = 0
    synced = 0
    skipped = 0
    errors = 0

    print("Starting Clerk user sync to Supabase users table...")

    while True:
        payload = fetch_clerk_users(clerk_client, cursor)
        users = payload if isinstance(payload, list) else payload.get("data") or payload.get("users") or []
        if not users:
            break

        for user in users:
            total += 1
            row = normalize_user_payload(user)
            if not row:
                skipped += 1
                print(f"Skipping Clerk user with missing id/email: {user.get('id')}")
                continue

            if dry_run:
                synced += 1
                continue

            try:
                svc.table("users").upsert(row, on_conflict="clerk_user_id").execute()
                synced += 1
            except Exception as exc:
                errors += 1
                print(f"Failed to sync user {row['clerk_user_id']}: {exc}")

        cursor = get_next_cursor(payload if isinstance(payload, dict) else {})
        if not cursor:
            break

    print("\nSync complete")
    print(f"  total clerk users scanned: {total}")
    print(f"  synced / upserted:       {synced}")
    print(f"  skipped:                 {skipped}")
    print(f"  errors:                  {errors}")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync existing Clerk users into the Supabase users table used by ClauseGuardian."
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would sync without writing to Supabase.")
    args = parser.parse_args()

    raise SystemExit(sync_users(dry_run=args.dry_run))
