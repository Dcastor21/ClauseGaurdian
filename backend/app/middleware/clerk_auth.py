# FILE: clerk_auth.py | PURPOSE: Validate Clerk JWTs on every protected endpoint and return clerk_user_id | CONNECTS TO: injected via FastAPI Depends() in all protected routers

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import logging
import jwt                                        # PyJWT — the JWT decode/verify library
from jwt import PyJWKClient                       # handles JWKS fetching and key rotation automatically
from fastapi import HTTPException, Depends        # Depends = FastAPI's dependency injection
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # extracts Bearer token from header

from app.config import settings                   # CLERK_JWT_ISSUER for issuer pinning

logger = logging.getLogger(__name__)


# ── TOKEN EXTRACTOR ───────────────────────────────────────────────────────────
# HTTPBearer parses the "Authorization: Bearer <token>" header.
# auto_error=True makes FastAPI return HTTP 403 immediately if the header is absent,
# before our code even runs — no need to handle the missing-token case explicitly.
bearer_scheme = HTTPBearer(auto_error=True)


# ── JWKS CLIENT CACHE ─────────────────────────────────────────────────────────
# WHY: Creating a new PyJWKClient on every request would re-fetch the JWKS from
# Clerk on every single authenticated endpoint call. That's a network round-trip
# for every request, which is both slow and fragile.
#
# The cache key is the JWKS URL string; the value is the PyJWKClient instance.
# In practice there's exactly one entry — the JWKS URL for our pinned issuer.
_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    """
    WHY: Returns a cached PyJWKClient for the given JWKS URL.

    Args:
        jwks_url: Clerk JWKS endpoint, e.g. "https://fond-doe-12.clerk.accounts.dev/.well-known/jwks.json"

    Returns:
        PyJWKClient: cached client that fetches and caches Clerk's public signing keys
    """
    if jwks_url not in _jwks_clients:
        # lifespan=300: re-fetch JWKS if it hasn't been refreshed in 5 minutes.
        _jwks_clients[jwks_url] = PyJWKClient(jwks_url, lifespan=300)
        logger.debug(f"Created PyJWKClient for {jwks_url}")
    return _jwks_clients[jwks_url]


# ── PRECOMPUTED ISSUER & JWKS URL ─────────────────────────────────────────────
# Strip any trailing slash so string equality with payload["iss"] is reliable.
# Clerk's `iss` claim is always the Frontend API URL with NO trailing slash.
_EXPECTED_ISSUER = settings.CLERK_JWT_ISSUER.rstrip("/")
_JWKS_URL = f"{_EXPECTED_ISSUER}/.well-known/jwks.json"


# ── MAIN DEPENDENCY ───────────────────────────────────────────────────────────
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    WHY: This is the FastAPI dependency injected into every protected endpoint.
    It validates the Clerk JWT and extracts the clerk_user_id, which is the
    single user identifier used everywhere in ClauseGuardian.

    SECURITY NOTE — issuer pinning:
    A previous version of this module read the `iss` claim from the unverified
    JWT and used it to build the JWKS URL. That meant an attacker could forge
    a token claiming `iss=https://attacker.com`, host their own JWKS at that
    URL, and we would happily fetch the attacker's public key and "verify" the
    forged signature against it. Now we pin the expected issuer at startup
    via CLERK_JWT_ISSUER and reject any token whose `iss` doesn't match BEFORE
    going to the network.

    HOW TO USE in a router:
        @router.get("/contracts")
        async def list_contracts(clerk_user_id: str = Depends(get_current_user_id)):
            # clerk_user_id is now the verified user, e.g. "user_2abc123xyz"

    FLOW:
      1. FastAPI's HTTPBearer has already extracted the raw JWT
      2. Decode without verification to read the `iss` claim
      3. Reject if `iss` ≠ pinned CLERK_JWT_ISSUER (issuer pinning — security gate)
      4. Use the pre-computed JWKS URL (built once from the pinned issuer)
      5. Let PyJWKClient find the right public key by matching the JWT's `kid`
      6. Verify the JWT signature, expiry, algorithm (RS256), and `iss` claim
      7. Return the `sub` claim (= clerk_user_id)

    Args:
        credentials: injected by FastAPI — contains the raw Bearer token string

    Returns:
        str: clerk_user_id from the verified JWT 'sub' claim, e.g. "user_2abc123xyz"

    Raises:
        HTTPException 401: any of — expired token, invalid signature, malformed JWT,
                           wrong issuer, missing claims, network failure fetching JWKS
        HTTPException 403: raised by HTTPBearer if Authorization header is missing entirely
    """
    token = credentials.credentials

    try:
        # ── STEP 1: Decode header/payload without signature verification ──────
        # WHY: We need the `iss` claim to compare against our pinned value.
        # An attacker can put anything in this claim — we're not trusting it,
        # we're using it as a fast-fail gate before any network call.
        unverified_payload: dict = jwt.decode(
            token,
            options={"verify_signature": False},
        )

        token_issuer: str = unverified_payload.get("iss", "").rstrip("/")
        if not token_issuer:
            logger.warning("JWT rejected: missing issuer claim (iss)")
            raise HTTPException(status_code=401, detail="Token missing issuer claim (iss)")

        # ── STEP 2: ISSUER PIN — security gate ────────────────────────────────
        # If the token claims a different issuer than the one we pinned at
        # startup, reject immediately. Do NOT fetch JWKS from an unpinned URL.
        if token_issuer != _EXPECTED_ISSUER:
            logger.warning(
                f"JWT rejected: issuer mismatch. expected={_EXPECTED_ISSUER!r} "
                f"got={token_issuer!r}"
            )
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        # ── STEP 3: Fetch the matching public key from the PINNED JWKS URL ────
        # We use _JWKS_URL (computed from the pinned issuer), NOT a URL derived
        # from the token. PyJWKClient reads `kid` from the JWT header and finds
        # the matching key in Clerk's JWKS response.
        jwks_client = _get_jwks_client(_JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # ── STEP 4: Verify signature, claims, and pinned issuer ──────────────
        # algorithms=["RS256"]: explicit allowlist prevents algorithm confusion
        # (e.g., an attacker switching alg to "none").
        # issuer=_EXPECTED_ISSUER: PyJWT enforces the iss claim matches.
        #   This is redundant with our step 2 check, but defense-in-depth is
        #   cheap and ensures the verified payload's iss is also pinned.
        # verify_aud=False: Clerk JWTs don't always include the 'aud' claim,
        #   so we skip audience verification rather than fail on its absence.
        payload: dict = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_EXPECTED_ISSUER,
            options={"verify_aud": False},
        )

        # ── STEP 5: Extract the user ID ───────────────────────────────────────
        clerk_user_id: str = payload.get("sub", "")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Token missing subject claim (sub)")

        logger.debug(f"Authenticated request for clerk_user_id={clerk_user_id}")
        return clerk_user_id

    except HTTPException:
        # Re-raise our own HTTP errors unchanged
        raise

    except jwt.ExpiredSignatureError as e:
        logger.warning("JWT rejected: token has expired")
        raise HTTPException(status_code=401, detail="Token has expired — please sign in again") from e

    except jwt.InvalidIssuerError as e:
        # Raised by PyJWT in step 4 if the verified iss doesn't match _EXPECTED_ISSUER.
        # Should be unreachable (step 2 catches this first) but kept as a safety net.
        logger.warning(f"JWT rejected: issuer mismatch at verification step: {e}")
        raise HTTPException(status_code=401, detail="Invalid token issuer") from e

    except jwt.InvalidTokenError as e:
        # Covers: bad signature, wrong algorithm, malformed base64, etc.
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token") from e

    except Exception as e:
        # Catch-all for network errors (JWKS unreachable), unexpected payload shapes, etc.
        logger.error(f"Unexpected auth error: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed") from e

