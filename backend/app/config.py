from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    CLERK_SECRET_KEY: str
    CLERK_WEBHOOK_SECRET: str
    CLERK_JWT_ISSUER: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    OPENROUTER_API_KEY: str
    HELICONE_API_KEY: str
    HELICONE_BASE_URL: str = "https://openrouter.helicone.ai/api/v1"
    LLM_MODEL: str = "anthropic/claude-3-haiku"
    RESEND_API_KEY: str
    RESEND_FROM_ADDRESS: str = "onboarding@resend.dev"
    NTFY_TOPIC: str
    UPSTASH_REDIS_REST_URL: str
    UPSTASH_REDIS_REST_TOKEN: str
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    SENTRY_DSN: str = ""
    ENVIRONMENT: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
