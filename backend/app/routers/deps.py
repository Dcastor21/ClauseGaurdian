from fastapi import HTTPException

from app.db.supabase import get_service_client


def verify_contract_owner(contract_id: str, clerk_user_id: str) -> None:
    client = get_service_client()
    try:
        client.table("contracts").select("id").eq("id", contract_id).eq(
            "clerk_user_id", clerk_user_id
        ).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Contract not found.")
