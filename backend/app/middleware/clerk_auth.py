# FILE: clerk_auth.py | PURPOSE: Validate Clerk JWTs on every protected endpoint and return clerk_user_id | CONNECTS TO: injected via FastAPI Depends() in all protected routers

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import logging
import jwt                                        # PyJWT — the JWT decode/verify library
from jwt import PyJWKClient                       # handles JWKS fetching and key rotation automatically
from fastapi import HTTPException, Depends        # Depends = FastAPI's dependency injection
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # extracts Bearer token from header

logger = logging.getLogger(__name__)



# ── TOKEN EXTRACTOR ───────────────────────────────────────────────────────────
# HTTPBearer parses the "Authorization: Bearer <token>" header.
# auto_error=True makes FastAPI return HTTP 403 immediately if the header is absent,
# before our code even runs — no need to handle the missing-token case explicitly.
#
# Decision: We use HTTPBearer instead of OAuth2PasswordBearer because Clerk
# issues short-lived JWTs directly, not password-derived tokens.
bearer_scheme = HTTPBearer(auto_error=True)


# ── JWKS CLIENT CACHE ─────────────────────────────────────────────────────────
# WHY: Creating a new PyJWKClient on every request would re-fetch the JWKS from
# Clerk on every single authenticated endpoint call. That's a network round-trip
# for every request, which is both slow and fragile.
#
# Instead, we cache one PyJWKClient per issuer (Clerk instance).
# PyJWKClient internally caches the JWKS keys and re-fetches only when it
# encounters a key ID (kid) it hasn't seen before — which handles key rotation.
#
# The dict key is the JWKS URL string; the value is the PyJWKClient instance.
_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    """
    WHY: Returns a cached PyJWKClient for the given JWKS URL.
    One client per Clerk instance (there's typically only one in production).

    FLOW:
      1. Check _jwks_clients dict for existing client at this URL
      2. If not found: create a new PyJWKClient, cache it, return it
      3. If found: return the cached client immediately

    Args:
        jwks_url: Clerk JWKS endpoint, e.g. "https://fond-doe-12.clerk.accounts.dev/.well-known/jwks.json"

    Returns:
        PyJWKClient: cached client that fetches and caches Clerk's public signing keys
    """
    if jwks_url not in _jwks_clients:
        # lifespan_seconds=300: re-fetch JWKS if it hasn't been refreshed in 5 minutes.
        # This is a safety net for key rotation; PyJWKClient also re-fetches on unknown kid.
        _jwks_clients[jwks_url] = PyJWKClient(jwks_url, lifespan=300)
        logger.debug(f"Created PyJWKClient for {jwks_url}")
    return _jwks_clients[jwks_url]


# ── MAIN DEPENDENCY ───────────────────────────────────────────────────────────
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    WHY: This is the FastAPI dependency injected into every protected endpoint.
    It validates the Clerk JWT and extracts the clerk_user_id, which is the
    single user identifier used everywhere in ClauseGuardian.

    HOW TO USE in a router:
        @router.get("/contracts")
        async def list_contracts(clerk_user_id: str = Depends(get_current_user_id)):
            # clerk_user_id is now the verified user, e.g. "user_2abc123xyz"

    FLOW:
      1. FastAPI's HTTPBearer has already extracted the raw JWT from the Authorization header
      2. Decode the JWT without verification to extract the issuer ('iss') claim
         We need the issuer to know which Clerk instance's JWKS endpoint to use
      3. Build the JWKS URL: issuer + "/.well-known/jwks.json"
         Clerk always puts its public keys at this path
      4. Get (or create) a PyJWKClient for this JWKS URL
      5. Let PyJWKClient find the right public key by matching the JWT's key ID (kid)
      6. Verify the JWT signature using that public key
      7. Verify standard claims: not expired, correct algorithm (RS256)
      8. Extract and return the 'sub' claim (= clerk_user_id)

    Args:
        credentials: injected by FastAPI — contains the raw Bearer token string

    Returns:
        str: clerk_user_id from the verified JWT 'sub' claim, e.g. "user_2abc123xyz"

    Raises:
        HTTPException 401: any of — expired token, invalid signature, malformed JWT,
                           missing claims, network failure fetching JWKS
        HTTPException 403: raised by HTTPBearer if Authorization header is missing entirely
    """
    token = credentials.credentials

    try:
        # ── STEP 1: Decode header/payload without signature verification ──────
        # WHY: We need the 'iss' (issuer) claim to know which JWKS endpoint to call.
        # We haven't verified the signature yet — this is intentional.
        # An attacker could forge the issuer claim, but the signature check in step 5
        # will fail if the token wasn't actually signed by Clerk.
        unverified_payload: dict = jwt.decode(
            token,
            options={"verify_signature": False},  # explicitly bypass signature — we verify below
        )

        issuer: str = unverified_payload.get("iss", "")
        if not issuer:
            # A real Clerk JWT always has 'iss'. Missing = not a Clerk token.
            logger.warning("JWT rejected: missing issuer claim (iss) — likely wrong token type")
            raise HTTPException(status_code=401, detail="Token missing issuer claim (iss)")

        # ── STEP 2: Build the JWKS URL from the issuer ────────────────────────
        # Clerk's JWKS endpoint is always: {issuer}/.well-known/jwks.json
        # Example: "https://fond-doe-12.clerk.accounts.dev/.well-known/jwks.json"
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"

        # ── STEP 3: Fetch the matching public key ─────────────────────────────
        # PyJWKClient reads the 'kid' (key ID) from the JWT header, then finds
        # the matching key in Clerk's JWKS response.
        # Failure here: network error, unknown kid (key rotation), JWKS endpoint down
        jwks_client = _get_jwks_client(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # ── STEP 4: Verify signature and standard claims ──────────────────────
        # algorithms=["RS256"]: Clerk uses RS256 (asymmetric). Explicitly allowlisting
        # prevents algorithm confusion attacks (e.g., changing alg to "none").
        # verify_aud=False: Clerk JWTs don't always include the 'aud' claim,
        # so we skip audience verification rather than fail on its absence.
        payload: dict = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

        # ── STEP 5: Extract the user ID ───────────────────────────────────────
        # 'sub' (subject) is the Clerk user ID in every JWT Clerk issues.
        # This is the canonical user identifier for ClauseGuardian — used as FK in every table.
        clerk_user_id: str = payload.get("sub", "")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Token missing subject claim (sub)")

        logger.debug(f"Authenticated request for clerk_user_id={clerk_user_id}")
        return clerk_user_id

    except HTTPException:
        # Re-raise our own HTTP errors unchanged — don't wrap them in a generic 401
        raise

    except jwt.ExpiredSignatureError as e:
        # Token's 'exp' claim is in the past. Frontend should refresh the JWT.
        logger.warning("JWT rejected: token has expired")
        raise HTTPException(status_code=401, detail="Token has expired — please sign in again") from e

    except jwt.InvalidTokenError as e:
        # Covers: bad signature, wrong algorithm, malformed base64, etc.
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token") from e

    except Exception as e:
        # Catch-all for network errors (JWKS unreachable), unexpected payload shapes, etc.
        # We log the full error server-side but return a generic message to avoid leaking internals.
        logger.error(f"Unexpected auth error: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed") from e


# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: get_current_user_id is a FastAPI dependency that validates Clerk JWTs
#          and returns the clerk_user_id. Inject it with Depends(get_current_user_id).
# TO TEST: 1. Get a real Clerk JWT from your frontend (or via Clerk's dashboard)
#          2. Call any protected endpoint with "Authorization: Bearer <token>"
#          3. Should return 200; tampered or missing tokens should return 401
# NEXT:    routers/contracts.py uses Depends(get_current_user_id) on every endpoint
