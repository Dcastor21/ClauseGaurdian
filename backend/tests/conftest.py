import base64
import hashlib
import hmac
import os
import time
from unittest.mock import MagicMock

# Must come before any app import — get_settings() reads these at import time
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_fake")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_Y2xhdXNlZ3VhcmRpYW5fdGVzdF9rZXk=")
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

import jwt
import pytest
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings

get_settings.cache_clear()

# One RSA key pair shared across all JWT tests
_PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend(),
)
_PUBLIC_KEY = _PRIVATE_KEY.public_key()

TEST_USER_ID = "user_test123"
TEST_ISSUER = "https://test.clerk.dev"


def make_jwt(
    user_id: str = TEST_USER_ID,
    iss: str = TEST_ISSUER,
    expired: bool = False,
    tamper: bool = False,
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iss": iss,
        "iat": now,
        "exp": now - 60 if expired else now + 3600,
    }
    token = jwt.encode(payload, _PRIVATE_KEY, algorithm="RS256")
    if tamper:
        parts = token.split(".")
        sig = parts[2]
        parts[2] = ("B" if sig[0] != "B" else "A") + sig[1:]
        token = ".".join(parts)
    return token


def make_svix_headers(body: bytes, msg_id: str = "msg_test_001") -> dict:
    raw_secret = base64.b64decode(
        os.environ["CLERK_WEBHOOK_SECRET"].removeprefix("whsec_")
    )
    timestamp = str(int(time.time()))
    to_sign = f"{msg_id}.{timestamp}.{body.decode()}"
    sig = hmac.new(raw_secret, to_sign.encode(), hashlib.sha256).digest()
    return {
        "svix-id": msg_id,
        "svix-timestamp": timestamp,
        "svix-signature": f"v1,{base64.b64encode(sig).decode()}",
    }


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
    mock_jwks = _mock_jwks_for(_PUBLIC_KEY)
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
