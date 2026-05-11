import logging

from fastapi import Depends, HTTPException
from upstash_redis.asyncio import Redis

from app.config import get_settings
from app.middleware.clerk_auth import get_current_user_id

logger = logging.getLogger(__name__)

_MAX_REQUESTS = 10
_WINDOW_SECONDS = 3600

# Atomically increments the counter, sets TTL on first write, and returns
# {1, 0} if allowed or {0, remaining_ttl} if the limit is exceeded.
_RATE_LIMIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
if count > tonumber(ARGV[2]) then
    return {0, redis.call('TTL', KEYS[1])}
end
return {1, 0}
"""


def _get_redis() -> Redis:
    settings = get_settings()
    return Redis(url=settings.UPSTASH_REDIS_REST_URL, token=settings.UPSTASH_REDIS_REST_TOKEN)


async def check_rate_limit(clerk_user_id: str) -> tuple[bool, int]:
    """
    Returns (allowed, retry_after_seconds).
    Fixed-window: max _MAX_REQUESTS per _WINDOW_SECONDS per user.
    Fails open on Redis errors so an Upstash outage never blocks uploads.
    """
    redis = _get_redis()
    key = f"rate_limit:upload:{clerk_user_id}"
    try:
        result = await redis.eval(
            _RATE_LIMIT_SCRIPT,
            keys=[key],
            args=[str(_WINDOW_SECONDS), str(_MAX_REQUESTS)],
        )
        return bool(int(result[0])), int(result[1])
    except Exception as e:
        logger.warning(f"[rate_limit] Redis unavailable for {clerk_user_id}: {e}")
        return True, 0


async def require_upload_rate_limit(
    clerk_user_id: str = Depends(get_current_user_id),
) -> None:
    allowed, retry_after = await check_rate_limit(clerk_user_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Upload limit reached ({_MAX_REQUESTS} per hour). "
                f"Try again in {max(retry_after // 60, 1)} minutes."
            ),
            headers={"Retry-After": str(retry_after)},
        )
