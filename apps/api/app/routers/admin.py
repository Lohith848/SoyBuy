"""
Admin / governance and user profile API. Spec E.2.

Reads and persists real user profile records in PostgreSQL app_user_profile,
and provides reviewable audit log streams from audit_log table.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, Header
from pydantic import BaseModel
from sqlalchemy import text

from app.db import get_connection
from app.services.blocked import BlockedCalculation

router = APIRouter()


class ProfileSyncRequest(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    role: Optional[str] = "buyer"
    organization: Optional[str] = "ABT-CPD"


@router.get("/me")
async def get_current_user(user_id: Optional[str] = Query(None)):
    """
    Resolve the current user from app_user_profile.
    Returns the user profile if an authenticated user exists in DB.
    """
    with get_connection() as conn:
        if conn is not None:
            if user_id:
                row = conn.execute(
                    text("""select user_id, email, full_name, role
                            from app_user_profile where user_id = cast(:uid as uuid) and is_active = true limit 1"""),
                    {"uid": user_id},
                ).fetchone()
            else:
                row = conn.execute(
                    text("""select user_id, email, full_name, role
                            from app_user_profile where is_active = true limit 1""")
                ).fetchone()

            if row:
                return {
                    "authenticated": True,
                    "user_id": str(row[0]),
                    "email": row[1],
                    "display_name": row[2] or row[1].split("@")[0],
                    "full_name": row[2] or "",
                    "role": str(row[3]),
                    "organization": "ABT-CPD Agri-Business",
                }
    return {
        "authenticated": False,
        "user_id": None,
        "email": None,
        "display_name": "Guest Buyer",
        "role": "viewer",
        "organization": "ABT-CPD",
    }


@router.post("/profile")
async def sync_user_profile(payload: ProfileSyncRequest):
    """
    Upsert user profile from Supabase Auth session into app_user_profile.
    """
    role = payload.role if payload.role in ("admin", "manager", "buyer", "viewer") else "buyer"
    display = payload.full_name or payload.email.split("@")[0]
    with get_connection() as conn:
        if conn is None:
            raise BlockedCalculation("DATABASE_UNAVAILABLE", "Database unavailable.", ["db_offline"])
        conn.execute(
            text("""
                insert into app_user_profile (user_id, email, full_name, role, is_active)
                values (cast(:uid as uuid), :email, :name, cast(:role as app_role), true)
                on conflict (user_id) do update set
                  email = excluded.email,
                  full_name = excluded.full_name,
                  role = excluded.role
            """),
            {
                "uid": payload.user_id,
                "email": payload.email,
                "name": display,
                "role": role,
            },
        )
        # Log to audit log
        conn.execute(
            text("""
                insert into audit_log (actor_label, action, entity, entity_id, detail)
                values (:actor, 'profile_updated', 'app_user_profile', :uid, :detail)
            """),
            {
                "actor": payload.email,
                "uid": payload.user_id,
                "detail": f"User profile updated: {display} ({role})"
            }
        )

    return {
        "status": "success",
        "user_id": payload.user_id,
        "email": payload.email,
        "full_name": display,
        "role": role,
        "organization": payload.organization,
    }


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
