"""
Decisions repository.
Append-only audit trail of human procurement decisions.
Starts empty (DR-9); no seeded/fabricated decisions.
"""

from __future__ import annotations

import datetime
import json
import logging
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from app.db import get_connection

logger = logging.getLogger(__name__)


def record_decision(
    recommendation_id: str,
    action: str,
    decided_by: Optional[str] = None,
    note: Optional[str] = None,
    modified_lines: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Appends an immutable decision record to the decisions and audit_log tables.
    """
    decision_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat() + "Z"
    action_clean = action.lower().strip()

    with get_connection() as conn:
        if conn is None:
            raise RuntimeError("Database unavailable")

        # Insert decision
        conn.execute(
            text("""
                INSERT INTO decisions
                  (id, recommendation_id, action, modified_lines, note, decided_by, decided_at)
                VALUES
                  (:id, :recommendation_id, CAST(:action AS decision_action), :modified_lines, :note, :decided_by, now())
            """),
            {
                "id": decision_id,
                "recommendation_id": recommendation_id,
                "action": action_clean,
                "modified_lines": json.dumps(modified_lines or {}),
                "note": note or "",
                "decided_by": decided_by,
            }
        )

        # Update recommendation status
        conn.execute(
            text("""
                UPDATE recommendations
                SET status = CAST(:status AS rec_status)
                WHERE id = :rec_id
            """),
            {"status": action_clean, "rec_id": recommendation_id}
        )

        # Log into audit_log
        conn.execute(
            text("""
                INSERT INTO audit_log (actor, actor_label, action, entity, entity_id, detail)
                VALUES (:actor, :actor_label, :action, 'decision', :decision_id, :detail)
            """),
            {
                "actor": decided_by,
                "actor_label": decided_by or "Lead Buyer",
                "action": f"decision_{action_clean}",
                "decision_id": decision_id,
                "detail": json.dumps({
                    "recommendation_id": recommendation_id,
                    "action": action_clean,
                    "note": note,
                    "modified_lines": modified_lines,
                }),
            }
        )

        return {
            "id": decision_id,
            "recommendation_id": recommendation_id,
            "action": action_clean,
            "decided_by": decided_by or "Lead Buyer",
            "decided_at": now,
            "note": note,
            "modified_lines": modified_lines,
        }


def list_decisions(limit: int = 100) -> List[Dict[str, Any]]:
    """
    Retrieves recorded decisions in reverse chronological order.
    Starts empty per DR-9.
    """
    with get_connection() as conn:
        if conn is None:
            return []
        res = conn.execute(
            text("""
                SELECT d.id, d.recommendation_id, d.action, d.modified_lines, d.note, d.decided_by, d.decided_at,
                       r.headline
                FROM decisions d
                LEFT JOIN recommendations r ON d.recommendation_id = r.id
                ORDER BY d.decided_at DESC
                LIMIT :limit
            """),
            {"limit": limit}
        )
        decisions = []
        for r in res.fetchall():
            decisions.append({
                "id": str(r[0]),
                "recommendation_id": str(r[1]) if r[1] else None,
                "action": str(r[2]),
                "modified_lines": r[3] if isinstance(r[3], dict) else json.loads(r[3] or "{}"),
                "note": r[4],
                "decided_by": str(r[5]) if r[5] else "Lead Buyer",
                "decided_at": r[6].isoformat() if r[6] else None,
                "recommendation_headline": r[7],
            })
        return decisions


def get_decision_by_id(decision_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return None
        res = conn.execute(
            text("""
                SELECT id, recommendation_id, action, modified_lines, note, decided_by, decided_at
                FROM decisions
                WHERE id = :id
            """),
            {"id": decision_id}
        )
        r = res.fetchone()
        if not r:
            return None
        return {
            "id": str(r[0]),
            "recommendation_id": str(r[1]) if r[1] else None,
            "action": str(r[2]),
            "modified_lines": r[3] if isinstance(r[3], dict) else json.loads(r[3] or "{}"),
            "note": r[4],
            "decided_by": str(r[5]) if r[5] else "Lead Buyer",
            "decided_at": r[6].isoformat() if r[6] else None,
        }
