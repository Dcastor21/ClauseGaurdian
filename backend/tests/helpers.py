"""Shared test helpers — imported by test modules."""
import base64
import hashlib
import hmac
import os
import time

import jwt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa

_PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend(),
)
PUBLIC_KEY = _PRIVATE_KEY.public_key()

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
