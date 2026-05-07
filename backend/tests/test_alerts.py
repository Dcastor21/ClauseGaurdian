from unittest.mock import AsyncMock, MagicMock, patch

import pytest

CONTRACT_ID = "66666666-6666-6666-6666-666666666666"
USER_ID = "user_alerts_test"


@pytest.fixture
def mock_alerts_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.services.alerts.get_service_client", lambda: mock_client)
    return mock_client


# --- send_email_alert ---

async def test_send_email_alert_success_returns_true(mock_alerts_supabase):
    from app.services.alerts import send_email_alert

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await send_email_alert(
            to_email="user@example.com",
            subject="Test subject",
            body_html="<p>Body</p>",
            contract_id=CONTRACT_ID,
            clerk_user_id=USER_ID,
        )

    assert result is True


async def test_send_email_alert_writes_alert_log_on_success(mock_alerts_supabase):
    from app.services.alerts import send_email_alert

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        await send_email_alert(
            to_email="user@example.com",
            subject="Test subject",
            body_html="<p>Body</p>",
            contract_id=CONTRACT_ID,
            clerk_user_id=USER_ID,
        )

    mock_alerts_supabase.table.assert_called_with("alert_logs")
    insert_row = mock_alerts_supabase.table.return_value.insert.call_args[0][0]
    assert insert_row["channel"] == "email"
    assert insert_row["clerk_user_id"] == USER_ID
    assert insert_row["contract_id"] == CONTRACT_ID


async def test_send_email_alert_http_error_returns_false(mock_alerts_supabase):
    from app.services.alerts import send_email_alert

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(side_effect=Exception("Connection refused"))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await send_email_alert(
            to_email="user@example.com",
            subject="Test",
            body_html="<p>Body</p>",
            contract_id=None,
            clerk_user_id=USER_ID,
        )

    assert result is False


async def test_send_email_alert_failure_does_not_write_log(mock_alerts_supabase):
    from app.services.alerts import send_email_alert

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(side_effect=Exception("Network error"))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        await send_email_alert("u@e.com", "s", "<p>b</p>", None, USER_ID)

    mock_alerts_supabase.table.assert_not_called()


async def test_send_email_alert_no_contract_id_omits_field(mock_alerts_supabase):
    from app.services.alerts import send_email_alert

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        await send_email_alert("u@e.com", "s", "<p>b</p>", None, USER_ID)

    insert_row = mock_alerts_supabase.table.return_value.insert.call_args[0][0]
    assert "contract_id" not in insert_row


# --- send_push_alert ---

async def test_send_push_alert_success_returns_true(mock_alerts_supabase):
    from app.services.alerts import send_push_alert

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await send_push_alert(
            title="Alert title",
            message="Alert message",
            contract_id=CONTRACT_ID,
            clerk_user_id=USER_ID,
        )

    assert result is True


async def test_send_push_alert_writes_alert_log_on_success(mock_alerts_supabase):
    from app.services.alerts import send_push_alert

    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        await send_push_alert("Title", "Message", CONTRACT_ID, USER_ID)

    insert_row = mock_alerts_supabase.table.return_value.insert.call_args[0][0]
    assert insert_row["channel"] == "push"
    assert insert_row["clerk_user_id"] == USER_ID


async def test_send_push_alert_failure_returns_false(mock_alerts_supabase):
    from app.services.alerts import send_push_alert

    with patch("app.services.alerts.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(side_effect=Exception("ntfy.sh unreachable"))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await send_push_alert("Title", "Message", None, USER_ID)

    assert result is False


# --- _log_alert ---

def test_log_alert_includes_contract_id_when_provided(mock_alerts_supabase):
    from app.services.alerts import _log_alert

    _log_alert(mock_alerts_supabase, USER_ID, CONTRACT_ID, "email", "Subject")

    row = mock_alerts_supabase.table.return_value.insert.call_args[0][0]
    assert row["contract_id"] == CONTRACT_ID
    assert row["channel"] == "email"
    assert row["clerk_user_id"] == USER_ID


def test_log_alert_omits_contract_id_when_none(mock_alerts_supabase):
    from app.services.alerts import _log_alert

    _log_alert(mock_alerts_supabase, USER_ID, None, "push", "Title: Message")

    row = mock_alerts_supabase.table.return_value.insert.call_args[0][0]
    assert "contract_id" not in row


def test_log_alert_db_failure_is_silent(mock_alerts_supabase):
    from app.services.alerts import _log_alert

    mock_alerts_supabase.table.return_value.insert.return_value.execute.side_effect = Exception("DB error")
    # Should not raise
    _log_alert(mock_alerts_supabase, USER_ID, None, "email", "Test")


def test_log_alert_truncates_long_messages(mock_alerts_supabase):
    from app.services.alerts import _log_alert

    long_message = "x" * 1000
    _log_alert(mock_alerts_supabase, USER_ID, None, "email", long_message)

    row = mock_alerts_supabase.table.return_value.insert.call_args[0][0]
    assert len(row["message"]) <= 500
