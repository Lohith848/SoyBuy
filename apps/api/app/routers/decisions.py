"""
Decisions and Audit Log API router. Spec E.2 GET /decisions, POST /decisions.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.schemas.models import DecisionRecord
from app.services.data_store import store
from app.repositories.decisions import record_decision
from app.repositories.recommendations import get_latest_recommendation

router = APIRouter()


class DecisionCreateRequest(BaseModel):
    recommendation_id: Optional[str] = None
    action: str  # approve, modify, reject
    note: Optional[str] = None
    decided_by: Optional[str] = None
    modified_quantities_t: Optional[Dict[str, Any]] = None


@router.get("/decisions", response_model=List[DecisionRecord])
async def list_decisions():
    """
    Get audit-ready decision log of all manager actions (approve, modify, reject).
    """
    return store.decisions


@router.post("/decisions", response_model=DecisionRecord)
async def create_decision(payload: DecisionCreateRequest):
    """
    Record an append-only procurement decision and update recommendation state.
    """
    rec_id = payload.recommendation_id
    if not rec_id:
        latest = get_latest_recommendation()
        if latest:
            rec_id = latest["id"]
        else:
            raise HTTPException(status_code=404, detail="No active recommendation to decide on.")

    action = payload.action.lower().strip()
    if action not in ("approve", "modify", "reject"):
        raise HTTPException(status_code=422, detail="Action must be approve, modify, or reject")

    saved = record_decision(
        recommendation_id=rec_id,
        action=action,
        decided_by=payload.decided_by,
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


@router.get("/export/decisions.csv")
async def export_decisions_csv():
    """
    Export decision audit trail as CSV for compliance.
    """
    from fastapi.responses import PlainTextResponse

    lines = ["decision_id,recommendation_id,action,decided_by,decided_at,note"]
    for d in store.decisions:
        note_esc = f'"{d.note}"' if d.note else '""'
        decided_by = d.decided_by or "Authorized Buyer"
        lines.append(
            f"{d.id},{d.recommendation_id},{d.action},{decided_by},{d.decided_at.isoformat()},{note_esc}"
        )
    return PlainTextResponse(content="\n".join(lines), media_type="text/csv")
