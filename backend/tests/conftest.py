import os
from unittest.mock import AsyncMock, MagicMock

# Must come before any app import — get_settings() reads these at import time
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_fake")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_test_fake")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://test.clerk.dev")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("OPENROUTER_API_KEY", "sk-or-test")
os.environ.setdefault("HELICONE_API_KEY", "sk-helicone-test")
os.environ.setdefault("RESEND_API_KEY", "re_test")
os.environ.setdefault("NTFY_TOPIC", "test-topic")
os.environ.setdefault("UPSTASH_REDIS_REST_URL", "https://test.upstash.io")
os.environ.setdefault("UPSTASH_REDIS_REST_TOKEN", "test-token")
os.environ.setdefault("SENTRY_DSN", "")
os.environ.setdefault("ENVIRONMENT", "development")

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from tests.helpers import PUBLIC_KEY

get_settings.cache_clear()


def _mock_jwks_for(public_key):
    mock_key = MagicMock()
    mock_key.key = public_key
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.return_value = mock_key
    return mock_client


@pytest.fixture
def main_client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(monkeypatch):
    mock_jwks = _mock_jwks_for(PUBLIC_KEY)
    monkeypatch.setattr(
        "app.middleware.clerk_auth._get_jwks_client", lambda url: mock_jwks
    )

    from app.middleware.clerk_auth import get_current_user_id

    test_app = FastAPI()

    @test_app.get("/protected")
    async def protected(user_id: str = Depends(get_current_user_id)):
        return {"user_id": user_id}

    with TestClient(test_app) as c:
        yield c


@pytest.fixture
def mock_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr(
        "app.routers.webhooks.get_service_client", lambda: mock_client
    )
    return mock_client


@pytest.fixture
def webhook_client(mock_supabase):
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_contracts_supabase(monkeypatch):
    mock_client = MagicMock()
    monkeypatch.setattr("app.routers.contracts.get_service_client", lambda: mock_client)
    return mock_client


@pytest.fixture
def contracts_client(monkeypatch, mock_contracts_supabase):
    mock_jwks = _mock_jwks_for(PUBLIC_KEY)
    monkeypatch.setattr("app.middleware.clerk_auth._get_jwks_client", lambda url: mock_jwks)

    async def noop_pipeline(*args, **kwargs):
        pass
    monkeypatch.setattr("app.routers.contracts._run_analysis_pipeline", noop_pipeline)
    # Bypass rate limiting in upload tests — not the subject under test here
    monkeypatch.setattr(
        "app.middleware.rate_limit.check_rate_limit",
        AsyncMock(return_value=(True, 0)),
    )

    from app.main import app

    with TestClient(app) as c:
        yield c
