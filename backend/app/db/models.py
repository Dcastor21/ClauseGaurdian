# FILE: models.py | PURPOSE: Pydantic v2 models that mirror every DB table — request validation and response serialization | CONNECTS TO: imported by all routers, services, and webhooks

# ── IMPORTS ───────────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field  # v2 BaseModel — strict typing, .model_validate(), .model_dump()
from datetime import datetime           # maps to TIMESTAMPTZ columns in Postgres
from uuid import UUID                   # maps to UUID primary keys
from typing import Optional             # for nullable columns


# ── DESIGN PATTERN ────────────────────────────────────────────────────────────
# Each table has three model variants:
#   XxxBase   — shared fields (no id, no created_at)
#   XxxCreate — what the caller sends in; often excludes DB-generated fields
#   XxxRead   — what the API returns; includes all fields including DB-generated ones
#
# This pattern prevents accidentally returning internal fields (like service keys)
# and makes validation errors explicit at the boundary, not deep in service code.


# ── USERS ─────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    """Shared fields for the users table. Does not include DB-generated id or created_at."""
    clerk_user_id: str                                          # Clerk's user.id — FK used throughout
    email: str
    plan: str = "free"                                          # free | pro | enterprise
    alert_preferences: dict = Field(
        default_factory=lambda: {"email": True, "push": True}  # default: both channels on
    )


class UserCreate(UserBase):
    """
    WHY: Used by the Clerk webhook handler when user.created fires.
    No additional fields beyond UserBase — the DB generates id and created_at.
    """
    pass


class UserRead(UserBase):
    """
    WHY: Returned from GET /api/v1/users/me — includes the DB-generated fields
    the frontend needs for display (plan tier, alert preferences).

    model_config from_attributes=True allows Pydantic to accept Supabase
    response dicts directly via UserRead.model_validate(row).
    """
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ── CONTRACTS ─────────────────────────────────────────────────────────────────

class ContractBase(BaseModel):
    """Shared contract fields. status and overall_risk have defaults."""
    name: str
    file_url: Optional[str] = None        # Supabase Storage path set after upload
    status: str = "processing"            # processing | analyzing | complete | failed
    overall_risk: Optional[str] = None    # null until pipeline finishes: critical | high | medium | low
    expires_at: Optional[datetime] = None # contract expiry date, if found in text


class ContractCreate(ContractBase):
    """
    WHY: Payload for POST /api/v1/contracts/upload.
    clerk_user_id is set server-side from the verified JWT — never trust the client to send it.
    """
    clerk_user_id: str  # injected from the verified Clerk JWT, not from request body


class ContractRead(ContractBase):
    """Full contract row — returned by list and detail endpoints."""
    id: UUID
    clerk_user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ContractUpdate(BaseModel):
    """
    WHY: Partial update model for the pipeline to mark status and risk after analysis.
    Only includes fields the pipeline is allowed to change — prevents accidental overwrites.
    """
    status: Optional[str] = None
    overall_risk: Optional[str] = None
    file_url: Optional[str] = None


# ── CLAUSES ───────────────────────────────────────────────────────────────────

class ClauseBase(BaseModel):
    """
    Each field maps to one of the three UI zones on the clause card:
      raw_text          → zone 1 (legal language, monospace)
      summary           → zone 2 (plain English)
      recommended_action → zone 3 (what to do)
    """
    clause_type: str              # indemnification | ip_assignment | auto_renewal |
                                  # liability_cap | termination | confidentiality |
                                  # payment_terms | governing_law
    severity: str                 # critical | high | medium | low
    raw_text: Optional[str] = None
    summary: Optional[str] = None           # 2-3 sentence plain-language explanation
    recommended_action: Optional[str] = None
    page_ref: Optional[int] = None          # page number in the original PDF/DOCX


class ClauseCreate(ClauseBase):
    """WHY: Used by the LLM pipeline to write clause rows after extraction."""
    contract_id: UUID


class ClauseRead(ClauseBase):
    """Full clause row — returned by the contract detail endpoint."""
    id: UUID
    contract_id: UUID

    model_config = {"from_attributes": True}


# ── DEADLINES ─────────────────────────────────────────────────────────────────

class DeadlineBase(BaseModel):
    """A single deadline date extracted from a contract."""
    deadline_date: datetime
    alert_type: Optional[str] = None    # expiry | renewal | notice
    alert_status: str = "pending"       # pending | sent | failed


class DeadlineCreate(DeadlineBase):
    """WHY: Used by the deadline extraction service to insert deadline rows."""
    contract_id: UUID
    clause_id: Optional[UUID] = None    # nullable — some deadlines aren't from a specific clause


class DeadlineRead(DeadlineBase):
    """Full deadline row — returned in the contract detail sidebar."""
    id: UUID
    contract_id: UUID
    clause_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


# ── ALERT LOGS ────────────────────────────────────────────────────────────────

class AlertLogCreate(BaseModel):
    """
    WHY: Written by the alerts service after dispatching a notification.
    Append-only — no updates. clerk_user_id is denormalized so logs survive
    user deletion (no FK constraint on clerk_user_id in this table).
    """
    clerk_user_id: str
    contract_id: Optional[UUID] = None
    channel: str    # email | push
    message: str    # human-readable description of what was sent


class AlertLogRead(AlertLogCreate):
    """Full alert log row — returned in a future /alerts/history endpoint."""
    id: UUID
    sent_at: datetime

    model_config = {"from_attributes": True}


# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: 5 table groups, each with Base / Create / Read variants. Pydantic v2.
# TO TEST: Import any model and call .model_validate({"field": "value"}) — should
#          raise ValidationError if required fields are missing or have wrong types.
# NEXT:    Routers use these models as request body types and response_model= args.
