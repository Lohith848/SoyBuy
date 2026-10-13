"""Health and readiness endpoints.  Spec FR-ADM-05 / E.2."""

from fastapi import APIRouter
from pydantic import BaseModel
import os

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    git_sha: str | None = None


class ReadyResponse(BaseModel):
    status: str
    database: str
    schema_version: str | None = None


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health():
    return HealthResponse(
        status="ok",
        git_sha=os.getenv("GIT_SHA"),
    )


@router.get("/ready", response_model=ReadyResponse, summary="Readiness check")
async def ready():
    """
    Checks database connectivity.  Returns 503 when not ready.
    """
    from app.db import check_db_ready
    db_ok, schema_ver = check_db_ready()

    if not db_ok:
        from fastapi import HTTPException
        raise HTTPException(503, detail="Database not reachable")

    return ReadyResponse(
        status="ok",
        database="connected",
        schema_version=schema_ver,
    )
