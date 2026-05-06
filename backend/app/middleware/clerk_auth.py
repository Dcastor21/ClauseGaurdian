import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer(auto_error=True)

_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = PyJWKClient(jwks_url, lifespan=300)
    return _jwks_clients[jwks_url]


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    token = credentials.credentials

    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified.get("iss", "")
        if not issuer:
            raise HTTPException(status_code=401, detail="Token missing issuer claim (iss)")

        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        signing_key = _get_jwks_client(jwks_url).get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk JWTs omit aud
        )

        clerk_user_id = payload.get("sub", "")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Token missing subject claim (sub)")

        return clerk_user_id

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(status_code=401, detail="Token has expired — please sign in again") from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from e
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed") from e
