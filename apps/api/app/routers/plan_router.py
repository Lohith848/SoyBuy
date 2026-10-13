"""
Buy Plan Optimizer API router.  Spec E.2 POST /plan/optimize, GET /plans/latest.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.schemas.models import BuyPlanResult
from app.services.data_store import store

router = APIRouter()


class OptimizePlanRequest(BaseModel):
    risk_weight: Optional[float] = None


@router.post("/plan/optimize", response_model=BuyPlanResult)
@router.post("/plans/optimize", response_model=BuyPlanResult)
async def optimize_plan(payload: Optional[OptimizePlanRequest] = None):
    """
    Run the MILP buy-plan optimizer on the active forecast and settings.
    Returns 12-week procurement quantities, projected inventory levels, and cost paths.
    """
    overrides = {}
    if payload and payload.risk_weight is not None:
        overrides["risk_weight"] = payload.risk_weight
    return store.build_buy_plan(overrides=overrides)


@router.get("/plans/latest", response_model=BuyPlanResult)
async def get_latest_plan():
    """
    Get the most recently computed optimal buy plan.
    """
    return store.build_buy_plan()
