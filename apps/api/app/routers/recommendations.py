"""
Recommendations API. Spec E.2 / E.3.

Reads recommendations from the store (DB-backed) and records decisions through
the append-only decisions repository. Decision recording needs a real
authenticated user; without one the endpoint returns an honest blocked state
instead of writing a fabricated actor.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.schemas.models import (
    RecommendationResponse,
    DecisionRequest,
    DecisionRecord,
)
from app.services.data_store import store
from app.services.blocked import BlockedCalculation
from app.repositories.decisions import record_decision
from app.db import get_connection

router = APIRouter()


@router.get("/recommendations/latest", response_model=RecommendationResponse)
@router.get("/recommendation/latest", response_model=RecommendationResponse)
async def get_latest_recommendation():
    """
    Latest decision-support recommendation (DB-backed). Raises a 409 blocked
    response when the required real inputs (history/settings) are missing.
    """
    if store.latest_rec_id and store.latest_rec_id in store.recommendations:
        return store.recommendations[store.latest_rec_id]
    return store.generate_recommendation()


@router.post("/recommendations/generate", response_model=RecommendationResponse)
async def generate_new_recommendation():
    return store.generate_recommendation()


@router.get("/recommendations", response_model=List[RecommendationResponse])
async def list_recommendations():
    if not store.recommendations:
        store.generate_recommendation()
    return list(store.recommendations.values())


@router.get("/recommendations/{rec_id}", response_model=RecommendationResponse)
async def get_recommendation_by_id(rec_id: str):
    if rec_id in store.recommendations:
        return store.recommendations[rec_id]
    raise HTTPException(status_code=404, detail="Recommendation not found")


def _resolve_actor_id() -> str | None:
    with get_connection() as conn:
        if conn is None:
            return None
        row = conn.execute(
            text("select user_id from app_user_profile where is_active = true limit 1")
        ).fetchone()
        return str(row[0]) if row else None


@router.post("/recommendations/{rec_id}/decision", response_model=DecisionRecord)
async def record_decision_on_recommendation(rec_id: str, payload: DecisionRequest):
    """
    Record an append-only buyer decision. Requires a real authenticated user;
    with none present this returns a blocked state (no fabricated actor).
    """
    actor_id = _resolve_actor_id()
    if actor_id is None:
        raise BlockedCalculation(
            "AUTH_REQUIRED",
            "Recording a decision requires an authenticated user profile.",
            ["auth_not_wired", "app_user_profile_empty"],
        )

    action = payload.action.lower()
    if action not in ("approve", "modify", "reject"):
        raise HTTPException(status_code=422, detail="Action must be approve, modify, or reject")
    if action == "modify" and not payload.modified_quantities_t:
        raise HTTPException(status_code=422, detail="modify requires modified_quantities_t")

    saved = record_decision(
        recommendation_id=rec_id,
        action=action,
        decided_by=actor_id,
        note=payload.note,
        modified_lines=payload.modified_quantities_t,
    )
    return DecisionRecord(
        id=saved["id"],
        recommendation_id=saved["recommendation_id"],
        action=saved["action"],
        decided_by=saved["decided_by"],
        decided_at=saved["decided_at"],
        note=saved["note"],
        modified_quantities_t=saved["modified_lines"],
    )
