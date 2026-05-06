import json

from tests.helpers import make_svix_headers

_USER_CREATED = {
    "type": "user.created",
    "data": {
        "id": "user_abc123",
        "primary_email_address_id": "email_001",
        "email_addresses": [
            {"id": "email_001", "email_address": "test@example.com"}
        ],
    },
}


def _post(client, payload: dict, *, bad_sig: bool = False):
    body = json.dumps(payload).encode()
    headers = make_svix_headers(body)
    if bad_sig:
        headers["svix-signature"] = "v1,invalidsignaturedata=="
    headers["content-type"] = "application/json"
    return client.post("/webhooks/clerk", content=body, headers=headers)


# --- header validation ---

def test_missing_svix_headers_returns_400(webhook_client):
    resp = webhook_client.post("/webhooks/clerk", json={"type": "user.created"})
    assert resp.status_code == 400


def test_invalid_signature_returns_401(webhook_client, mock_supabase):
    resp = _post(webhook_client, _USER_CREATED, bad_sig=True)
    assert resp.status_code == 401


def test_invalid_signature_makes_no_db_write(webhook_client, mock_supabase):
    _post(webhook_client, _USER_CREATED, bad_sig=True)
    mock_supabase.table.assert_not_called()


# --- user.created ---

def test_user_created_returns_ok(webhook_client, mock_supabase):
    resp = _post(webhook_client, _USER_CREATED)
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_user_created_upserts_with_correct_data(webhook_client, mock_supabase):
    _post(webhook_client, _USER_CREATED)
    mock_supabase.table.assert_called_with("users")
    mock_supabase.table.return_value.upsert.assert_called_once_with(
        {
            "clerk_user_id": "user_abc123",
            "email": "test@example.com",
            "plan": "free",
            "alert_preferences": {"email": True, "push": True},
        },
        on_conflict="clerk_user_id",
    )


def test_user_created_twice_is_idempotent(webhook_client, mock_supabase):
    _post(webhook_client, _USER_CREATED)
    _post(webhook_client, _USER_CREATED)
    # Both calls succeed and both use upsert — DB handles deduplication
    assert mock_supabase.table.return_value.upsert.call_count == 2


# --- user.updated ---

def test_user_updated_updates_email(webhook_client, mock_supabase):
    payload = {
        "type": "user.updated",
        "data": {
            "id": "user_abc123",
            "primary_email_address_id": "email_002",
            "email_addresses": [
                {"id": "email_002", "email_address": "new@example.com"}
            ],
        },
    }
    resp = _post(webhook_client, payload)
    assert resp.status_code == 200
    mock_supabase.table.return_value.update.assert_called_once_with(
        {"email": "new@example.com"}
    )


# --- user.deleted ---

def test_user_deleted_calls_delete(webhook_client, mock_supabase):
    payload = {"type": "user.deleted", "data": {"id": "user_abc123"}}
    resp = _post(webhook_client, payload)
    assert resp.status_code == 200
    mock_supabase.table.return_value.delete.assert_called_once()


def test_user_deleted_filters_by_clerk_user_id(webhook_client, mock_supabase):
    payload = {"type": "user.deleted", "data": {"id": "user_abc123"}}
    _post(webhook_client, payload)
    mock_supabase.table.return_value.delete.return_value.eq.assert_called_once_with(
        "clerk_user_id", "user_abc123"
    )


# --- unknown events ---

def test_unknown_event_type_returns_ok(webhook_client, mock_supabase):
    payload = {"type": "organization.created", "data": {"id": "org_xyz"}}
    resp = _post(webhook_client, payload)
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock_supabase.table.assert_not_called()
