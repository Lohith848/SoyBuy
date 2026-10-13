"""
Plans repository.
Saves and retrieves MILP optimization plan runs and lines from PostgreSQL.
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


def save_plan_run(
    plan_data: Dict[str, Any],
    kind: str = "base",
    name: Optional[str] = None,
    overrides: Optional[Dict[str, Any]] = None,
    settings_version_id: Optional[str] = None,
    domestic_forecast_run_id: Optional[str] = None,
    international_forecast_run_id: Optional[str] = None,
) -> str:
    """
    Saves a completed plan run and its plan_lines.
    Returns plan_run_id.
    """
    plan_id = plan_data.get("plan_id") or str(uuid.uuid4())
    schedule = plan_data.get("schedule", [])
    solver_status = plan_data.get("solver_status", "optimal")
    fallback = bool(plan_data.get("fallback", False))
    obj_val = float(plan_data.get("likely_total_cost_inr", 0.0))

    with get_connection() as conn:
        if conn is None:
            raise RuntimeError("Database unavailable")

        # Insert plan_runs
        conn.execute(
            text("""
                INSERT INTO plan_runs
                  (id, kind, name, domestic_forecast_run_id, international_forecast_run_id,
                   settings_version_id, inputs, overrides, solver_status, fallback, objective_value, result)
                VALUES
                  (:id, CAST(:kind AS plan_kind), :name, :dom_fct, :int_fct,
                   :settings_id, :inputs, :overrides, CAST(:solver_status AS solver_status_type), :fallback, :obj_val, :result)
                ON CONFLICT (id) DO UPDATE SET
                  result = EXCLUDED.result,
                  objective_value = EXCLUDED.objective_value;
            """),
            {
                "id": plan_id,
                "kind": kind,
                "name": name or f"Plan {kind} {datetime.date.today()}",
                "dom_fct": domestic_forecast_run_id,
                "int_fct": international_forecast_run_id,
                "settings_id": settings_version_id,
                "inputs": json.dumps(plan_data.get("inputs", {})),
                "overrides": json.dumps(overrides or {}),
                "solver_status": solver_status if solver_status in ('optimal', 'feasible_time_limit', 'fallback') else 'optimal',
                "fallback": fallback,
                "obj_val": obj_val,
                "result": json.dumps(plan_data),
            }
        )

        # Delete any existing lines if upserting
        conn.execute(text("DELETE FROM plan_lines WHERE plan_run_id = :plan_id"), {"plan_id": plan_id})

        # Insert plan_lines
        line_sql = text("""
            INSERT INTO plan_lines
              (plan_run_id, week_index, week_start, route, lots, tonnes,
               unit_cost_p50_inr_per_t, cost_low_inr, cost_likely_inr, cost_high_inr)
            VALUES
              (:plan_run_id, :week_index, :week_start, CAST(:route AS route_type), :lots, :tonnes,
               :unit_cost, :cost_low, :cost_likely, :cost_high)
        """)
        for item in schedule:
            conn.execute(line_sql, {
                "plan_run_id": plan_id,
                "week_index": item.get("week_index", 0),
                "week_start": item.get("order_week_start"),
                "route": item.get("route", "domestic"),
                "lots": item.get("lots", 0),
                "tonnes": item.get("tonnes", 0.0),
                "unit_cost": item.get("unit_cost_inr_per_t", 0.0),
                "cost_low": item.get("total_cost_inr", 0.0),
                "cost_likely": item.get("total_cost_inr", 0.0),
                "cost_high": item.get("total_cost_inr", 0.0),
            })

        return plan_id


def get_latest_plan_run(kind: str = "base") -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return None
        res = conn.execute(
            text("""
                SELECT id, result, solver_status, objective_value, created_at
                FROM plan_runs
                WHERE kind = CAST(:kind AS plan_kind)
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"kind": kind}
        )
        r = res.fetchone()
        if not r:
            return None
        result_dict = r[1] if isinstance(r[1], dict) else json.loads(r[1])
        result_dict["plan_id"] = str(r[0])
        result_dict["solver_status"] = str(r[2])
        return result_dict


def get_plan_run_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return None
        res = conn.execute(
            text("""
                SELECT id, result, solver_status, objective_value, created_at
                FROM plan_runs
                WHERE id = :id
            """),
            {"id": plan_id}
        )
        r = res.fetchone()
        if not r:
            return None
        result_dict = r[1] if isinstance(r[1], dict) else json.loads(r[1])
        result_dict["plan_id"] = str(r[0])
        return result_dict
