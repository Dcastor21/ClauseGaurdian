from unittest.mock import MagicMock, patch

import app.middleware.clerk_auth as auth_mod
from tests.helpers import TEST_USER_ID, make_jwt


def test_no_auth_header_returns_401(auth_client):
    resp = auth_client.get("/protected")
    assert resp.status_code == 401


def test_valid_jwt_returns_user_id(auth_client):
    token = make_jwt()
    resp = auth_client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["user_id"] == TEST_USER_ID


def test_different_user_id_in_jwt_is_returned(auth_client):
    token = make_jwt(user_id="user_other_456")
    resp = auth_client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["user_id"] == "user_other_456"


def test_expired_jwt_returns_401(auth_client):
    token = make_jwt(expired=True)
    resp = auth_client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


def test_tampered_jwt_returns_401(auth_client):
    token = make_jwt(tamper=True)
    resp = auth_client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_jwks_client_cached_for_same_issuer():
    auth_mod._jwks_clients.clear()
    try:
        with patch("app.middleware.clerk_auth.PyJWKClient") as mock_cls:
            mock_cls.return_value = MagicMock()
            url = "https://example.clerk.dev/.well-known/jwks.json"
            c1 = auth_mod._get_jwks_client(url)
            c2 = auth_mod._get_jwks_client(url)
            assert c1 is c2
            mock_cls.assert_called_once()
    finally:
        auth_mod._jwks_clients.clear()


def test_different_issuers_get_separate_jwks_clients():
    auth_mod._jwks_clients.clear()
    try:
        with patch("app.middleware.clerk_auth.PyJWKClient") as mock_cls:
            mock_cls.side_effect = lambda *a, **kw: MagicMock()
            c1 = auth_mod._get_jwks_client("https://issuer-a.clerk.dev/.well-known/jwks.json")
            c2 = auth_mod._get_jwks_client("https://issuer-b.clerk.dev/.well-known/jwks.json")
            assert c1 is not c2
            assert mock_cls.call_count == 2
    finally:
        auth_mod._jwks_clients.clear()
