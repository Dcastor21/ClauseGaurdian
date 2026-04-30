# FILE: config.py | PURPOSE: Load and validate all environment variables at startup | CONNECTS TO: imported by every module that needs settings via `from app.config import settings`

# ── IMPORTS ───────────────────────────────────────────────────────────────────
from pydantic_settings import BaseSettings, SettingsConfigDict  # reads .env file automatically and validates types
from functools import lru_cache                                  # ensures Settings() is built only once per process


# ── SETTINGS MODEL ────────────────────────────────────────────────────────────
class Settings(BaseSettings):
    """
    WHY: Centralizing all config in one typed object means:
    - Missing env vars crash at startup with a clear error (not mid-request)
    - Type mismatches are caught before they cause silent bugs
    - Every module gets settings from one source of truth, never os.getenv()

    FLOW:
      1. Pydantic reads the .env file (or real environment variables in production)
      2. Each field is type-checked; required fields with no default raise ValidationError
      3. get_settings() returns a cached singleton — reading .env happens exactly once

    Where to find each key is documented inline on every field.
    """

    model_config = SettingsConfigDict(
        env_file=".env",             # load from .env in the working directory
        env_file_encoding="utf-8",
        extra="ignore",              # silently ignore unknown env vars (e.g. PATH, HOME)
    )

    # ── CLERK ─────────────────────────────────────────────────────────────────
    # NEVER expose CLERK_SECRET_KEY to the frontend — it can impersonate any user.
    # Find at: Clerk Dashboard → API Keys → Secret Keys
    CLERK_SECRET_KEY: str

    # Webhook signing secret — used by svix to verify Clerk event payloads
    # Find at: Clerk Dashboard → Webhooks → your endpoint → Signing Secret
    CLERK_WEBHOOK_SECRET: str

    # ── SUPABASE ──────────────────────────────────────────────────────────────
    # Project URL — safe to share, not a secret
    # Find at: Supabase Dashboard → Settings → API → Project URL
    SUPABASE_URL: str

    # Anon public key — respects RLS policies, safe for user-scoped operations
    # Find at: Supabase Dashboard → Settings → API → anon public
    SUPABASE_ANON_KEY: str

    # Service role key — BYPASSES ALL RLS. Never log, never expose to frontend.
    # Use ONLY in webhook handlers and background scheduler jobs.
    # Find at: Supabase Dashboard → Settings → API → service_role secret
    SUPABASE_SERVICE_ROLE_KEY: str

    # ── LLM ───────────────────────────────────────────────────────────────────
    # OpenRouter — routes LLM calls across providers
    # Find at: openrouter.ai → Keys → Create Key
    OPENROUTER_API_KEY: str

    # Helicone — LLM observability proxy; every OpenRouter call must go through it
    # Find at: helicone.ai → Settings → API Keys → Create API Key
    HELICONE_API_KEY: str

    # ── ALERTS ────────────────────────────────────────────────────────────────
    # Resend — transactional email API
    # Find at: resend.com → API Keys → Create API Key
    RESEND_API_KEY: str

    # Ntfy.sh — push notification topic (not a secret, but keep consistent across envs)
    # Find at: ntfy.sh → your topic URL, e.g. https://ntfy.sh/my-clauseguardian-alerts
    NTFY_TOPIC: str

    # ── RATE LIMITING ─────────────────────────────────────────────────────────
    # Upstash Redis REST URL — used by the rate limiter on /contracts/analyze
    # Find at: Upstash Console → your database → REST API → REST URL
    UPSTASH_REDIS_REST_URL: str

    # Upstash Redis REST token — authenticated access to the rate limit store
    # Find at: Upstash Console → your database → REST API → REST Token
    UPSTASH_REDIS_REST_TOKEN: str

    # ── MONITORING ────────────────────────────────────────────────────────────
    # Sentry DSN — empty string disables Sentry (add after core app is working)
    # Find at: Sentry → Project Settings → Client Keys (DSN) → Show DSN
    SENTRY_DSN: str = ""

    # ── APP ───────────────────────────────────────────────────────────────────
    # Controls log level and whether docs UI (/docs, /redoc) is exposed
    # Values: development | staging | production
    ENVIRONMENT: str = "development"


# ── SINGLETON FACTORY ─────────────────────────────────────────────────────────
@lru_cache
def get_settings() -> Settings:
    """
    WHY: lru_cache means Settings() is constructed exactly once — the .env file is
    read once at first call, then the same object is returned forever.
    This avoids re-reading disk on every request and makes tests easy (override
    the cache with get_settings.cache_clear() + monkeypatching).

    FLOW:
      1. First call: Pydantic reads .env, validates types, raises if anything is missing
      2. Subsequent calls: returns cached instance immediately from memory

    Returns:
        Settings: validated, populated settings object

    Raises:
        pydantic.ValidationError: if any required env var is missing or has wrong type
    """
    return Settings()


# Convenience alias — import this in other modules:
#   from app.config import settings
# Decision: we expose the instance directly rather than the factory because
# 99% of callers just need the object, not lazy loading.
settings = get_settings()

# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: All env vars loaded, typed, and validated by Pydantic at startup.
# TO TEST: Delete a required var from .env and run `uvicorn app.main:app` —
#          you should see a clear ValidationError, not a KeyError buried in a request.
# NEXT:    db/supabase.py uses settings.SUPABASE_URL + settings.SUPABASE_ANON_KEY
