from unittest.mock import AsyncMock, MagicMock, patch

import pytest

CONTRACT_ID = "77777777-7777-7777-7777-777777777777"
DEADLINE_ID = "88888888-8888-8888-8888-888888888888"
USER_ID = "user_scheduler_test"


def _deadline_row(
    alert_type: str = "7-day",
    deadline_date: str = "2025-12-31",
    clerk_user_id: str = USER_ID,
    contract_name: str = "Test Contract",
) -> dict:
    return {
        "id": DEADLINE_ID,
        "deadline_date": deadline_date,
        "contract_id": CONTRACT_ID,
        "alert_type": alert_type,
        "contracts": {"clerk_user_id": clerk_user_id, "name": contract_name},
    }


def _user_row(email: str = "user@example.com", email_pref: bool = True) -> dict:
    return {"email": email, "alert_preferences": {"email": email_pref, "push": True}}


@pytest.fixture
def mock_sched_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.scheduler.get_service_client", lambda: mock_client)
    return mock_client


@pytest.fixture
def mock_sched_email(monkeypatch):
    mock_fn = AsyncMock(return_value=True)
    monkeypatch.setattr("app.scheduler.send_email_alert", mock_fn)
    return mock_fn


# --- check_deadlines ---

async def test_check_deadlines_queries_all_four_windows(mock_sched_supabase, mock_sched_email):
    from app.scheduler import ALERT_WINDOWS, check_deadlines

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.lte.return_value.gte.return_value.execute.return_value.data = []

    await check_deadlines()

    # One query per alert window
    assert mock_sched_supabase.table.call_count == len(ALERT_WINDOWS)


async def test_check_deadlines_filters_by_pending_status(mock_sched_supabase, mock_sched_email):
    from app.scheduler import check_deadlines

    chain = mock_sched_supabase.table.return_value.select.return_value
    chain.eq.return_value.eq.return_value.lte.return_value.gte.return_value.execute.return_value.data = []

    await check_deadlines()

    # Verify alert_status=pending is in the chain of eq() calls
    eq_calls = [str(c) for c in chain.eq.call_args_list]
    assert any("pending" in c for c in eq_calls)


# --- _process_deadline_alert ---

async def test_process_alert_sends_email_when_prefs_allow(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = _user_row()

    await _process_deadline_alert(mock_sched_supabase, _deadline_row(), "7-day", 7)

    mock_sched_email.assert_called_once()
    call_kwargs = mock_sched_email.call_args.kwargs
    assert call_kwargs["to_email"] == "user@example.com"
    assert "7" in call_kwargs["subject"]


async def test_process_alert_skips_email_when_pref_disabled(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = _user_row(email_pref=False)

    await _process_deadline_alert(mock_sched_supabase, _deadline_row(), "7-day", 7)

    mock_sched_email.assert_not_called()


async def test_process_alert_updates_status_to_sent_on_success(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = _user_row()
    mock_sched_email.return_value = True

    await _process_deadline_alert(mock_sched_supabase, _deadline_row(), "7-day", 7)

    update_call = mock_sched_supabase.table.return_value.update.call_args[0][0]
    assert update_call["alert_status"] == "sent"


async def test_process_alert_updates_status_to_failed_on_email_failure(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = _user_row()
    mock_sched_email.return_value = False

    await _process_deadline_alert(mock_sched_supabase, _deadline_row(), "7-day", 7)

    update_call = mock_sched_supabase.table.return_value.update.call_args[0][0]
    assert update_call["alert_status"] == "failed"


async def test_process_alert_skips_when_no_clerk_user_id(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    row = _deadline_row()
    row["contracts"] = {"clerk_user_id": None, "name": "Test"}

    await _process_deadline_alert(mock_sched_supabase, row, "7-day", 7)

    mock_sched_email.assert_not_called()


async def test_process_alert_skips_when_user_not_found(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

    await _process_deadline_alert(mock_sched_supabase, _deadline_row(), "7-day", 7)

    mock_sched_email.assert_not_called()


async def test_process_alert_handles_user_query_failure_gracefully(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB down")

    # Should not raise
    await _process_deadline_alert(mock_sched_supabase, _deadline_row(), "7-day", 7)
    mock_sched_email.assert_not_called()


async def test_process_alert_subject_contains_days_and_contract_name(mock_sched_supabase, mock_sched_email):
    from app.scheduler import _process_deadline_alert

    mock_sched_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = _user_row()

    await _process_deadline_alert(
        mock_sched_supabase,
        _deadline_row(contract_name="My NDA"),
        "30-day",
        30,
    )

    subject = mock_sched_email.call_args.kwargs["subject"]
    assert "30" in subject
    assert "My NDA" in subject
