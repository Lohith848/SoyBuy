"""
FastAPI application.  Entry point.  Spec C.1 / E.1.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root or current directory
root_env = Path(__file__).resolve().parents[3] / ".env"
if root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()


from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.services.blocked import BlockedCalculation

from app.routers import (
    health,
    series,
    uploads,
    settings_router,
    forecast_router,
    landed_cost_router,
    plan_router,
    scenarios,
    recommendations,
    decisions,
    backtests,
    data_status,
    analysis,
    admin,
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="SoyBuy API",
        description=(
            "Data-Driven Dynamic Soybean Procurement Decision Support System. "
            "PS-035 | Sakthi Hackathon 2.0 | Team SKH2-2026-00462"
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # CORS – exact origins only (spec NFR-03)
    allowed_origins = [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers injected via middleware
    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # Honest blocked-state responses (Master Spec E.1). A calculation that
    # cannot run on real data returns a structured error with `blockers`
    # instead of a fabricated fallback value.
    @app.exception_handler(BlockedCalculation)
    async def blocked_handler(request: Request, exc: BlockedCalculation):
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "blockers": exc.blockers,
                    "request_id": request.headers.get("X-Request-ID"),
                }
            },
        )

    # Capability truth source — the frontend renders only what is real.
    @app.get("/api/v1/features", tags=["Features"])
    async def features():
        from app.services.capabilities import get_capabilities
        return get_capabilities()

    # Routers
    prefix = "/api/v1"
    app.include_router(health.router, tags=["Health"])
    app.include_router(health.router, prefix=prefix, tags=["Health"])
    app.include_router(series.router, prefix=prefix, tags=["Series"])
    app.include_router(uploads.router, prefix=prefix, tags=["Uploads"])
    app.include_router(settings_router.router, prefix=prefix, tags=["Settings"])
    app.include_router(forecast_router.router, prefix=prefix, tags=["Forecast"])
    app.include_router(landed_cost_router.router, prefix=prefix, tags=["Landed Cost"])
    app.include_router(plan_router.router, prefix=prefix, tags=["Plans"])
    app.include_router(scenarios.router, prefix=prefix, tags=["Scenarios"])
    app.include_router(recommendations.router, prefix=prefix, tags=["Recommendations"])
    app.include_router(decisions.router, prefix=prefix, tags=["Decisions"])
    app.include_router(backtests.router, prefix=prefix, tags=["Backtest"])
    app.include_router(data_status.router, prefix=prefix, tags=["Data Status"])
    app.include_router(analysis.router, prefix=prefix, tags=["Analysis"])
    app.include_router(admin.router, prefix=prefix, tags=["Admin"])

    @app.on_event("startup")
    async def startup():
        logger.info("SoyBuy API starting. GIT_SHA=%s", os.getenv("GIT_SHA", "dev"))

    return app


app = create_app()
