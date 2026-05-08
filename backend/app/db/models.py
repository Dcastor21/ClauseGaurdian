from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class UserBase(BaseModel):
    clerk_user_id: str
    email: str
    plan: str = "free"
    alert_preferences: dict[str, Any] = Field(
        default_factory=lambda: {"email": True, "push": True}
    )


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ContractBase(BaseModel):
    name: str
    file_url: str | None = None
    status: str = "processing"
    overall_risk: str | None = None
    expires_at: datetime | None = None


class ContractCreate(ContractBase):
    clerk_user_id: str


class ContractRead(ContractBase):
    id: UUID
    clerk_user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ContractUpdate(BaseModel):
    status: str | None = None
    overall_risk: str | None = None
    file_url: str | None = None


class ClauseBase(BaseModel):
    clause_type: str
    severity: str
    raw_text: str | None = None
    summary: str | None = None
    recommended_action: str | None = None
    page_ref: int | None = None


class ClauseCreate(ClauseBase):
    contract_id: UUID


class ClauseRead(ClauseBase):
    id: UUID
    contract_id: UUID

    model_config = {"from_attributes": True}


class DeadlineBase(BaseModel):
    deadline_date: datetime
    alert_window: str | None = None
    alert_status: str = "pending"


class DeadlineCreate(DeadlineBase):
    contract_id: UUID
    clause_id: UUID | None = None


class DeadlineRead(DeadlineBase):
    id: UUID
    contract_id: UUID
    clause_id: UUID | None = None

    model_config = {"from_attributes": True}


class AlertLogCreate(BaseModel):
    clerk_user_id: str
    contract_id: UUID | None = None
    channel: str
    message: str


class AlertLogRead(AlertLogCreate):
    id: UUID
    sent_at: datetime

    model_config = {"from_attributes": True}
