import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import contracts, webhooks
from app.routers.clauses import router as clauses_router
from app.routers.deadlines import router as deadlines_router
from app.routers.users import router as users_router
from app.scheduler import shutdown_scheduler, start_scheduler

settings = get_settings()

if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=True,
        environment=settings.ENVIRONMENT,
        release=settings.ENVIRONMENT,
    )

logging.basicConfig(
    level=logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="ClauseGuardian API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    # Covers Vercel deploys + any local-network IP (192.168/10/172.16-31) on port 3000-3001.
    # Local IP ranges are safe here because the backend is not publicly reachable on LAN.
    allow_origin_regex=(
        r"^https://[a-z0-9-]+\.vercel\.app$"
        r"|^http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}):(3000|3001)$"
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "baggage", "sentry-trace"],
)


app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["Contracts"])
app.include_router(clauses_router, prefix="/api/v1/clauses", tags=["Clauses"])
app.include_router(deadlines_router, prefix="/api/v1/deadlines", tags=["Deadlines"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])


@app.get("/health", tags=["Ops"])
async def health_check() -> dict:
    return {"status": "ok", "environment": settings.ENVIRONMENT}

