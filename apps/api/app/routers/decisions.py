"""
Decisions and Audit Log API router.  Spec E.2 GET /decisions.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter
from app.schemas.models import DecisionRecord
from app.services.data_store import store

router = APIRouter()


@router.get("/decisions", response_model=List[DecisionRecord])
async def list_decisions():
    """
    Get audit-ready decision log of all manager actions (approve, modify, reject).
    """
    return store.decisions


@router.get("/export/decisions.csv")
async def export_decisions_csv():
    """
    Export decision audit trail as CSV for compliance.
    """
    from fastapi.responses import PlainTextResponse
    lines = ["decision_id,recommendation_id,action,decided_by,decided_at,note"]
    for d in store.decisions:
        note_esc = f'"{d.note}"' if d.note else '""'
        lines.append(f"{d.id},{d.recommendation_id},{d.action},{d.decided_by},{d.decided_at.isoformat()},{note_esc}")
    return PlainTextResponse(content="\n".join(lines), media_type="text/csv")
