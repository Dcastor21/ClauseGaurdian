# FILE: main.py | PURPOSE: FastAPI application entry point — wires together all routers, middleware, and lifecycle hooks | CONNECTS TO: config.py (settings), routers/webhooks.py, middleware/clerk_auth.py (used by future routers)

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import logging
from contextlib import asynccontextmanager        # modern startup/shutdown pattern (replaces @app.on_event)
from fastapi import FastAPI                        # the web framework
from fastapi.middleware.cors import CORSMiddleware # allow the Next.js frontend to call this API across origins

from app.config import settings                    # centralized env vars
from app.routers import webhooks                   # Clerk webhook event handler
from app.routers import contracts                  # contract upload, list, get, delete


# ── LOGGING ───────────────────────────────────────────────────────────────────
# Configure logging once here at the app entry point.
# All other modules get a child logger via logging.getLogger(__name__) and inherit this level.
# In production (Render), stdout is captured and forwarded to the Render log stream.
logging.basicConfig(
    level=logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── LIFESPAN ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    WHY: FastAPI's lifespan context manager is the correct place for startup and
    shutdown logic in modern FastAPI (≥0.93). The older @app.on_event decorator
    is deprecated and will be removed in a future release.

    FLOW:
      1. STARTUP: log that we're running, verify environment config is valid
         (Pydantic already validated required env vars at import time in config.py)
      2. yield: FastAPI serves requests normally
      3. SHUTDOWN: clean up resources — APScheduler will be stopped here in build step 13

    Note: We don't ping Supabase here because the client uses lazy initialization.
    Connection errors will surface on the first real DB call, which is acceptable.
    """
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info(
        f"ClauseGuardian API starting | "
        f"environment={settings.ENVIRONMENT} | "
        f"version=0.1.0"
    )

    # Decision: no explicit DB connectivity check at startup.
    # Supabase is a managed cloud service with high availability — probing it would
    # only slow cold starts on Render. Errors surface naturally on the first request.

    yield  # ←── application is live and serving requests between these two points

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("ClauseGuardian API shutting down")
    # TODO (build step 13): scheduler.shutdown() goes here


# ── APP INSTANCE ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="ClauseGuardian API",
    description=(
        "AI-native contract monitoring for startup ops leads and small business owners. "
        "Extract risky clauses, score legal exposure, and get alerted before deadlines cost you."
    ),
    version="0.1.0",
    lifespan=lifespan,
    # Disable interactive docs in production to avoid exposing API internals publicly.
    # In development, /docs gives you a live Swagger UI to test endpoints.
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)


# ── CORS ──────────────────────────────────────────────────────────────────────
# WHY: The Next.js frontend (hosted on Vercel) runs at a different origin than
# this API (hosted on Render). Browsers block cross-origin requests unless the
# server explicitly allows them via CORS response headers.
#
# Decision NOT to use allow_origins=["*"]:
# Wildcard origin + allow_credentials=True is a browser security violation —
# browsers reject it. More importantly, it would allow any website to make
# authenticated requests impersonating our logged-in users (CSRF risk).
#
# TODO before go-live: replace the Vercel wildcard with your exact production domain,
# e.g. "https://clauseguardian.vercel.app" or your custom domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # Next.js dev server (npm run dev)
        "http://localhost:3001",    # alternate port if 3000 is taken
        "https://*.vercel.app",     # all Vercel preview deployments for this project
    ],
    allow_credentials=True,         # required: lets the browser send Authorization headers
    allow_methods=["*"],            # GET, POST, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],            # Authorization, Content-Type, etc.
)


# ── ROUTERS ───────────────────────────────────────────────────────────────────
# WHY: Each router file handles one resource type (contracts, clauses, etc.).
# Mounting them here with a prefix keeps main.py thin — it's a wiring file, not logic.

app.include_router(
    webhooks.router,
    prefix="/webhooks",   # → POST /webhooks/clerk
    tags=["Webhooks"],    # groups these endpoints in /docs
)

app.include_router(
    contracts.router,
    prefix="/api/v1/contracts",   # → POST /api/v1/contracts/upload, GET /api/v1/contracts, etc.
    tags=["Contracts"],
)

# ── FUTURE ROUTERS (uncomment as each build step is completed) ─────────────
# from app.routers import clauses, deadlines
#
# app.include_router(
#     clauses.router,
#     prefix="/api/v1/clauses",     # → GET /api/v1/clauses/{id}
#     tags=["Clauses"],
# )
# app.include_router(
#     deadlines.router,
#     prefix="/api/v1/deadlines",   # → GET /api/v1/deadlines?contract_id=...
#     tags=["Deadlines"],
# )


# ── HEALTH ENDPOINT ───────────────────────────────────────────────────────────
@app.get("/health", tags=["Ops"])
async def health_check() -> dict:
    """
    WHY: Render uses this endpoint to decide if the container is healthy and ready
    to serve traffic. During deployment, Render polls /health; if it returns 200,
    the new revision goes live. If it returns non-200 or times out, Render rolls back.

    Also useful for ops: hitting /health tells you which environment and version
    is actually running, which helps debug "did my deploy land?" situations.

    FLOW:
      1. Build a response dict with status, version, and environment
      2. Return it — FastAPI serializes it to JSON with Content-Type: application/json

    Returns:
        dict: {"status": "ok", "version": "0.1.0", "environment": "production"}
    """
    return {
        "status": "ok",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,  # confirms which deploy is live
    }


# ── SUMMARY ───────────────────────────────────────────────────────────────────
# SUMMARY: FastAPI app with CORS, webhook router mounted at /webhooks, and /health endpoint.
# TO TEST: Run `uvicorn app.main:app --reload` from the backend/ directory.
#          Hit http://localhost:8000/health — should return {"status": "ok", ...}
#          Hit http://localhost:8000/docs — Swagger UI with all endpoints listed
# NEXT:    routers/contracts.py — POST /api/v1/contracts/upload with Clerk JWT gate
