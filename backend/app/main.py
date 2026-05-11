import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import contracts, webhooks
from app.routers.clauses import router as clauses_router
from app.routers.deadlines import router as deadlines_router
from app.scheduler import shutdown_scheduler, start_scheduler

settings = get_settings()

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
    ],
    # Regex covers all Vercel preview and production deploys.
    # allow_origins glob patterns (e.g. "https://*.vercel.app") are not supported
    # by starlette — they are treated as literal strings and never match.
    allow_origin_regex=r"^https://[a-z0-9-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["Contracts"])
app.include_router(clauses_router, prefix="/api/v1/clauses", tags=["Clauses"])
app.include_router(deadlines_router, prefix="/api/v1/deadlines", tags=["Deadlines"])


@app.get("/health", tags=["Ops"])
async def health_check() -> dict:
    return {"status": "ok", "environment": settings.ENVIRONMENT}
