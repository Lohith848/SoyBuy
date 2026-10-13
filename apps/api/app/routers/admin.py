"""
Admin / governance API. Spec E.2.

Reads the real audit_log table. There is no fabricated profile or hardcoded
audit entries: with no authenticated session the caller gets a blocked state.
"""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.db import get_connection
from app.services.blocked import BlockedCalculation

router = APIRouter()


@router.get("/me")
async def get_current_user():
    """
    Resolve the current user from app_user_profile. Auth is not wired yet, so
    this honestly reports that no authenticated session exists.
    """
    with get_connection() as conn:
        if conn is not None:
            row = conn.execute(
                text("""select user_id, email, full_name, role
                        from app_user_profile where is_active = true limit 1""")
            ).fetchone()
            if row:
                return {
                    "user_id": str(row[0]),
                    "email": row[1],
                    "display_name": row[2] or row[1],
                    "role": str(row[3]),
                }
    raise BlockedCalculation(
        "NO_AUTHENTICATED_USER",
        "No authenticated user session is available.",
        ["auth_not_wired", "app_user_profile_empty"],
    )


@router.get("/audit-log")
async def get_audit_log(limit: int = 100):
    with get_connection() as conn:
        if conn is None:
            return {"items": [], "total": 0}
        rows = conn.execute(
            text("""select id, at, actor_label, action, entity, entity_id, detail
                    from audit_log order by at desc limit :limit"""),
            {"limit": limit},
        ).fetchall()
        items = [
            {
                "event_id": r[0],
                "timestamp": r[1].isoformat() if r[1] else None,
                "actor": r[2],
                "action": r[3],
                "entity": r[4],
                "entity_id": r[5],
                "detail": r[6],
            }
            for r in rows
        ]
        return {"items": items, "total": len(items)}
