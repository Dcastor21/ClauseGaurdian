from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.db.models import (
    AlertLogCreate,
    ClauseCreate,
    ClauseRead,
    ContractCreate,
    ContractRead,
    DeadlineCreate,
    DeadlineRead,
    UserCreate,
    UserRead,
)

NOW = datetime.now(timezone.utc)
CONTRACT_ID = uuid4()
CLAUSE_ID = uuid4()


# --- UserCreate ---

def test_user_create_defaults():
    u = UserCreate(clerk_user_id="user_abc", email="a@b.com")
    assert u.plan == "free"
    assert u.alert_preferences == {"email": True, "push": True}


def test_user_read_requires_id_and_created_at():
    with pytest.raises(ValidationError):
        UserRead(clerk_user_id="user_abc", email="a@b.com")


# --- ContractCreate / ContractRead ---

def test_contract_create_requires_clerk_user_id():
    with pytest.raises(ValidationError):
        ContractCreate(name="Test Contract")


def test_contract_read_valid():
    c = ContractRead(
        id=CONTRACT_ID,
        clerk_user_id="user_abc",
        name="Test Contract",
        created_at=NOW,
    )
    assert c.status == "processing"
    assert c.overall_risk is None
    assert c.file_url is None


def test_contract_read_missing_id_raises():
    with pytest.raises(ValidationError):
        ContractRead(clerk_user_id="user_abc", name="Test", created_at=NOW)


def test_contract_read_missing_created_at_raises():
    with pytest.raises(ValidationError):
        ContractRead(id=CONTRACT_ID, clerk_user_id="user_abc", name="Test")


# --- ClauseCreate / ClauseRead ---

def test_clause_create_valid():
    c = ClauseCreate(
        contract_id=CONTRACT_ID,
        clause_type="indemnification",
        severity="critical",
    )
    assert c.summary is None
    assert c.recommended_action is None
    assert c.page_ref is None


def test_clause_create_missing_contract_id_raises():
    with pytest.raises(ValidationError):
        ClauseCreate(clause_type="indemnification", severity="critical")


def test_clause_read_missing_id_raises():
    with pytest.raises(ValidationError):
        ClauseRead(
            contract_id=CONTRACT_ID,
            clause_type="indemnification",
            severity="critical",
        )


# --- DeadlineCreate / DeadlineRead ---

def test_deadline_create_requires_deadline_date():
    with pytest.raises(ValidationError):
        DeadlineCreate(contract_id=CONTRACT_ID)


def test_deadline_create_defaults():
    d = DeadlineCreate(contract_id=CONTRACT_ID, deadline_date=NOW)
    assert d.alert_status == "pending"
    assert d.clause_id is None


def test_deadline_read_valid():
    d = DeadlineRead(
        id=CLAUSE_ID,
        contract_id=CONTRACT_ID,
        deadline_date=NOW,
    )
    assert d.clause_id is None
    assert d.alert_status == "pending"


# --- AlertLogCreate ---

def test_alert_log_create_valid():
    a = AlertLogCreate(
        clerk_user_id="user_abc",
        channel="email",
        message="Your contract expires in 7 days.",
    )
    assert a.contract_id is None


def test_alert_log_create_missing_required_fields():
    with pytest.raises(ValidationError):
        AlertLogCreate(channel="email")
