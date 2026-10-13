"""
Scenario simulation API router.  Spec E.2 / E.3 POST /scenarios/run, POST /scenarios/save, GET /scenarios.
"""

from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter
from app.schemas.models import (
    ScenarioRunRequest,
    ScenarioRunResponse,
)
from app.services.data_store import store

router = APIRouter()


@router.post("/scenarios/run", response_model=ScenarioRunResponse)
async def run_scenario(payload: ScenarioRunRequest):
    """
    Run what-if scenario simulation without saving.
    Supports domestic/import price shocks, FX shocks, transit delays, consumption change,
    and manager subjective view shifts.
    """
    # 1. Base plan
    base_plan = store.build_buy_plan()

    # 2. Overrides
    overrides: Dict[str, Any] = {
        "dom_price_shock_pct": payload.dom_price_shock_pct,
        "int_price_shock_pct": payload.int_price_shock_pct,
        "fx_shock_pct": payload.fx_shock_pct,
        "import_delay_weeks": payload.import_delay_weeks,
        "domestic_delay_weeks": payload.domestic_delay_weeks,
        "consumption_change_pct": payload.consumption_change_pct,
        "risk_weight": payload.risk_weight,
    }
    if payload.manager_view_dom_pct is not None:
        overrides["manager_view_dom_pct"] = payload.manager_view_dom_pct

    overrides_applied = [
        k for k, v in overrides.items()
        if (isinstance(v, (int, float)) and v != 0.0) or (k == "manager_view_dom_pct" and v is not None)
    ]

    import time
    t0 = time.perf_counter()
    scenario_plan = store.build_buy_plan(overrides=overrides)
    solver_ms = round((time.perf_counter() - t0) * 1000.0, 1)

    # Calculate deltas
    delta_cost = round(
        scenario_plan.cost_summary_inr["likely"] - base_plan.cost_summary_inr["likely"], 2
    )

    base_w0_tonnes = sum(p.quantity_t for p in base_plan.plan_lines if p.week_index == 0)
    scen_w0_tonnes = sum(p.quantity_t for p in scenario_plan.plan_lines if p.week_index == 0)
    delta_w0 = round(scen_w0_tonnes - base_w0_tonnes, 1)

    delta_shortage = round(scenario_plan.total_shortage_t - base_plan.total_shortage_t, 1)

    return ScenarioRunResponse(
        base_plan=base_plan,
        scenario_plan=scenario_plan,
        delta_likely_cost_inr=delta_cost,
        delta_week0_tonnes=delta_w0,
        delta_shortage_t=delta_shortage,
        overrides_applied=overrides_applied,
        solver_time_ms=solver_ms,
    )


@router.post("/scenarios/save")
async def save_scenario(payload: Dict[str, Any]):
    """Persist a named scenario to the database."""
    import json
    from sqlalchemy import text
    from app.db import get_connection

    name = str(payload.get("name") or "unnamed")
    with get_connection() as conn:
        if conn is None:
            raise RuntimeError("Database unavailable")
        row = conn.execute(
            text("""insert into saved_scenarios (name, overrides)
                    values (:name, cast(:overrides as jsonb)) returning id, created_at"""),
            {"name": name, "overrides": json.dumps(payload.get("overrides", payload))},
        ).fetchone()
    return {"id": str(row[0]), "name": name,
            "created_at": row[1].isoformat() if row[1] else None}


@router.get("/scenarios")
async def list_scenarios():
    """List persisted scenarios."""
    from sqlalchemy import text
    from app.db import get_connection

    with get_connection() as conn:
        if conn is None:
            return {"items": [], "total": 0}
        rows = conn.execute(
            text("select id, name, overrides, created_at from saved_scenarios order by created_at desc limit 100")
        ).fetchall()
        items = [
            {"id": str(r[0]), "name": r[1], "overrides": r[2],
             "created_at": r[3].isoformat() if r[3] else None}
            for r in rows
        ]
    return {"items": items, "total": len(items)}
