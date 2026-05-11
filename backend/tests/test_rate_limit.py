"""Tests for the per-user Upstash rate limiter."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from app.middleware.clerk_auth import get_current_user_id
from app.middleware.rate_limit import (
    check_rate_limit,
    require_upload_rate_limit,
    _MAX_REQUESTS,
    _WINDOW_SECONDS,
)


# ── helpers ──────────────────────────────────────────────────────────────────


def _mock_redis(eval_result: list) -> MagicMock:
    redis = MagicMock()
    redis.eval = AsyncMock(return_value=eval_result)
    return redis


def _rate_limit_app() -> FastAPI:
    app = FastAPI()
    app.dependency_overrides[get_current_user_id] = lambda: "user_test"

    @app.post("/upload")
    async def endpoint(_: None = Depends(require_upload_rate_limit)):
        return {"ok": True}

    return app


# ── check_rate_limit unit tests ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allows_first_request():
    with patch("app.middleware.rate_limit._get_redis", return_value=_mock_redis([1, 0])):
        allowed, retry_after = await check_rate_limit("alice")
    assert allowed is True
    assert retry_after == 0


@pytest.mark.asyncio
async def test_allows_request_at_exact_limit():
    with patch(
        "app.middleware.rate_limit._get_redis",
        return_value=_mock_redis([_MAX_REQUESTS, 0]),
    ):
        allowed, _ = await check_rate_limit("alice")
    assert allowed is True


@pytest.mark.asyncio
async def test_blocks_request_over_limit():
    with patch(
        "app.middleware.rate_limit._get_redis",
        return_value=_mock_redis([0, 1800]),
    ):
        allowed, retry_after = await check_rate_limit("alice")
    assert allowed is False
    assert retry_after == 1800


@pytest.mark.asyncio
async def test_rate_limit_key_is_per_user():
    mock_redis = _mock_redis([1, 0])
    with patch("app.middleware.rate_limit._get_redis", return_value=mock_redis):
        await check_rate_limit("alice")
        await check_rate_limit("bob")

    keys_used = [call.kwargs["keys"][0] for call in mock_redis.eval.call_args_list]
    assert keys_used[0] == "rate_limit:upload:alice"
    assert keys_used[1] == "rate_limit:upload:bob"


@pytest.mark.asyncio
async def test_lua_script_receives_correct_window_and_limit():
    mock_redis = _mock_redis([1, 0])
    with patch("app.middleware.rate_limit._get_redis", return_value=mock_redis):
        await check_rate_limit("alice")

    call_kwargs = mock_redis.eval.call_args.kwargs
    assert call_kwargs["args"][0] == str(_WINDOW_SECONDS)
    assert call_kwargs["args"][1] == str(_MAX_REQUESTS)


@pytest.mark.asyncio
async def test_fails_open_on_redis_error():
    redis = MagicMock()
    redis.eval = AsyncMock(side_effect=Exception("Upstash unavailable"))
    with patch("app.middleware.rate_limit._get_redis", return_value=redis):
        allowed, retry_after = await check_rate_limit("alice")
    assert allowed is True
    assert retry_after == 0


# ── require_upload_rate_limit dependency tests ────────────────────────────────


def test_dependency_passes_when_allowed():
    app = _rate_limit_app()
    with patch(
        "app.middleware.rate_limit.check_rate_limit",
        new=AsyncMock(return_value=(True, 0)),
    ):
        with TestClient(app) as client:
            resp = client.post("/upload")
    assert resp.status_code == 200


def test_dependency_returns_429_when_blocked():
    app = _rate_limit_app()
    with patch(
        "app.middleware.rate_limit.check_rate_limit",
        new=AsyncMock(return_value=(False, 3600)),
    ):
        with TestClient(app) as client:
            resp = client.post("/upload")
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
    assert resp.headers["Retry-After"] == "3600"


def test_429_detail_contains_limit():
    app = _rate_limit_app()
    with patch(
        "app.middleware.rate_limit.check_rate_limit",
        new=AsyncMock(return_value=(False, 3600)),
    ):
        with TestClient(app) as client:
            resp = client.post("/upload")
    assert str(_MAX_REQUESTS) in resp.json()["detail"]


def test_retry_after_header_rounds_up_to_one_minute_minimum():
    """A 30-second TTL must still show 'Try again in 1 minutes.'"""
    app = _rate_limit_app()
    with patch(
        "app.middleware.rate_limit.check_rate_limit",
        new=AsyncMock(return_value=(False, 30)),
    ):
        with TestClient(app) as client:
            resp = client.post("/upload")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "30"
    assert "1 minutes" in resp.json()["detail"]
