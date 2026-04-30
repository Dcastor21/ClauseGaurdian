# FILE: supabase.py | PURPOSE: Supabase client singletons — all DB and Storage access goes through here | CONNECTS TO: imported by routers, services, and webhooks; reads from config.py

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import logging
from supabase import create_client, Client  # official Supabase Python client (supabase-py)
from app.config import settings             # centralized env vars — never read os.environ directly

logger = logging.getLogger(__name__)


# ── WHY TWO CLIENTS ───────────────────────────────────────────────────────────
# ClauseGuardian uses two Supabase clients with different permission levels:
#
# 1. anon_client  → uses SUPABASE_ANON_KEY
#    - Respects Row Level Security (RLS) policies
#    - Use for all user-facing operations (list contracts, fetch clauses, etc.)
#    - Requests are scoped to the authenticated user via Clerk JWT in the header
#
# 2. service_client → uses SUPABASE_SERVICE_ROLE_KEY
#    - BYPASSES all RLS policies — sees every row in every table
#    - Use ONLY for: Clerk webhook handlers, APScheduler background jobs
#    - Never pass this client to a function that handles user HTTP requests
#
# Decision NOT to use a single client with header-switching:
# Keeping separate singletons makes it impossible to accidentally use the
# service key in a user-facing context — the call sites are unambiguous.

_anon_client: Client | None = None
_service_client: Client | None = None


def get_anon_client() -> Client:
    """
    WHY: Returns the anon-key client for user-scoped operations.
    RLS policies in schema.sql ensure each user can only see their own rows.
    To scope a request to a specific user, pass their Clerk JWT via:
        client.postgrest.auth(jwt_token)
    before chaining your query.

    FLOW:
      1. Check if _anon_client is already created (module-level singleton)
      2. If not: create it with SUPABASE_URL + SUPABASE_ANON_KEY
      3. Cache it in _anon_client and return

    Returns:
        Client: Supabase client initialized with the public anon key

    Raises:
        Exception: if SUPABASE_URL or SUPABASE_ANON_KEY are empty/invalid
                   (this would be caught at startup by Pydantic validation)
    """
    global _anon_client
    if _anon_client is None:
        # Failure here means SUPABASE_URL or SUPABASE_ANON_KEY is wrong.
        # Check: Supabase Dashboard → Settings → API → Project URL + anon public
        _anon_client = create_client(
            settings.SUPABASE_URL,       # e.g. "https://xyzxyz.supabase.co"
            settings.SUPABASE_ANON_KEY,  # public key — safe, but still never log it
        )
        logger.info("Supabase anon client initialized")
    return _anon_client


def get_service_client() -> Client:
    """
    WHY: Returns the service-role client that bypasses RLS.
    Required for operations that span users or run in background contexts
    where there is no JWT to authenticate with.

    PERMITTED USE CASES:
      - webhooks.py: Clerk user.created → insert users row
      - scheduler.py: read all pending deadlines across all users
      - alerts.py: write alert_logs entries for any user

    FORBIDDEN: Do NOT inject this into FastAPI dependencies that serve user requests.

    FLOW:
      1. Check if _service_client is already created
      2. If not: create it with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
      3. Cache and return

    Returns:
        Client: Supabase client initialized with the service role key

    Raises:
        Exception: if SUPABASE_SERVICE_ROLE_KEY is empty/invalid
    """
    global _service_client
    if _service_client is None:
        # CRITICAL: this key bypasses all RLS.
        # If it leaks, an attacker can read and write every row in the database.
        # Never log it, never include it in error responses.
        _service_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
        logger.info("Supabase service client initialized")
    return _service_client


# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: Two lazy-initialized Supabase clients — anon (RLS-enforced) and service (RLS-bypassed).
# TO TEST: Call get_anon_client() in a REPL with valid .env — should return a Client instance.
#          Try a SELECT on any table with the anon key — should return [] (RLS blocks anonymous access).
# NEXT:    Routers import get_anon_client(); webhooks.py imports get_service_client()
