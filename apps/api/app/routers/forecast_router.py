"""
Forecast API router.  Spec E.2 POST /forecast/runs, GET /forecast/latest, GET /forecast/runs.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.schemas.models import ForecastResult
from app.services.data_store import store

router = APIRouter()


class ForecastRunRequest(BaseModel):
    target: str = "DOM_SOY_BENCH"
    override_reason: Optional[str] = None


@router.post("/forecast/runs", response_model=ForecastResult)
async def run_forecast(payload: Optional[ForecastRunRequest] = None):
    """
    Trigger or refresh a 12-week price forecast with quantile prediction bands (p10, p50, p90).
    """
    return store.generate_or_get_forecast(force_refresh=True)


@router.get("/forecast/latest", response_model=ForecastResult)
async def get_latest_forecast(target: str = Query("DOM_SOY_BENCH")):
    """
    Get the latest active price forecast and evaluation metrics.
    """
    return store.generate_or_get_forecast(force_refresh=False)


@router.get("/forecast/runs")
async def list_forecast_runs():
    """
    List historical forecast runs and metrics.
    """
    fc = store.generate_or_get_forecast(force_refresh=False)
    return {
        "items": [
            {
                "run_id": fc.run_id,
                "target": fc.target,
                "origin_date": fc.origin_date.isoformat(),
                "model_name": fc.model_name,
                "metrics": fc.metrics,
                "created_at": fc.created_at.isoformat(),
            }
        ],
        "total": 1,
    }
