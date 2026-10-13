"""
Recommendations repository.
Saves and retrieves dynamic procurement recommendations with factual reasoning.
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


def save_recommendation(rec_data: Dict[str, Any]) -> str:
    """
    Saves a recommendation row linked to plan_run_id.
    """
    rec_id = rec_data.get("id") or str(uuid.uuid4())
    status = rec_data.get("status", "pending")
    if status not in ("pending", "approved", "modified", "rejected", "superseded"):
        status = "pending"

    # Mark prior pending recommendations as superseded
    with get_connection() as conn:
        if conn is None:
            raise RuntimeError("Database unavailable")

        conn.execute(
            text("""
                UPDATE recommendations
                SET status = 'superseded'::rec_status
                WHERE status = 'pending'::rec_status AND id != :rec_id
            """),
            {"rec_id": rec_id}
        )

        conn.execute(
            text("""
                INSERT INTO recommendations
                  (id, plan_run_id, headline, reasons, confidence, review_date,
                   facts, snapshot, explain_version, data_origin_summary, status)
                VALUES
                  (:id, :plan_run_id, :headline, :reasons, :confidence, :review_date,
                   :facts, :snapshot, :explain_version, :data_origin_summary, CAST(:status AS rec_status))
                ON CONFLICT (id) DO UPDATE SET
                  headline = EXCLUDED.headline,
                  reasons = EXCLUDED.reasons,
                  confidence = EXCLUDED.confidence,
                  status = EXCLUDED.status,
                  snapshot = EXCLUDED.snapshot;
            """),
            {
                "id": rec_id,
                "plan_run_id": rec_data.get("plan_run_id"),
                "headline": rec_data.get("headline", ""),
                "reasons": json.dumps(rec_data.get("reasons", [])),
                "confidence": rec_data.get("confidence", "medium"),
                "review_date": rec_data.get("review_date") or datetime.date.today().isoformat(),
                "facts": json.dumps(rec_data.get("facts", {})),
                "snapshot": json.dumps(rec_data),
                "explain_version": rec_data.get("explain_version", "v1.0"),
                "data_origin_summary": json.dumps(rec_data.get("data_origin_summary", {"real": True, "sample": False})),
                "status": status,
            }
        )
        return rec_id


def get_latest_recommendation() -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return None
        res = conn.execute(
            text("""
                SELECT id, snapshot, status, created_at
                FROM recommendations
                ORDER BY created_at DESC
                LIMIT 1
            """)
        )
        r = res.fetchone()
        if not r:
            return None
        snap = r[1] if isinstance(r[1], dict) else json.loads(r[1])
        snap["id"] = str(r[0])
        snap["status"] = str(r[2])
        return snap


def get_recommendation_by_id(rec_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return None
        res = conn.execute(
            text("""
                SELECT id, snapshot, status, created_at
                FROM recommendations
                WHERE id = :id
            """),
            {"id": rec_id}
        )
        r = res.fetchone()
        if not r:
            return None
        snap = r[1] if isinstance(r[1], dict) else json.loads(r[1])
        snap["id"] = str(r[0])
        snap["status"] = str(r[2])
        return snap


def list_recommendations(limit: int = 20) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return []
        res = conn.execute(
            text("""
                SELECT id, headline, confidence, review_date, status, created_at
                FROM recommendations
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            {"limit": limit}
        )
        return [
            {
                "id": str(r[0]),
                "headline": r[1],
                "confidence": r[2],
                "review_date": r[3].isoformat() if r[3] else None,
                "status": str(r[4]),
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in res.fetchall()
        ]
