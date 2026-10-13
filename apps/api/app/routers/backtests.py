"""
Historical Replay / Backtest API (Master Spec E.2, C.10).

Reads REAL stored runs from backtest_runs / backtest_results. POST triggers the
walk-forward engine (apps/api/app/jobs/backtest_replay.py). When no succeeded run
exists it returns a blocked response — it never invents savings or intervals.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter
from sqlalchemy import text

from app.db import get_connection
from app.services.blocked import BlockedCalculation
from app.services.backtest import STRATEGY_LABELS

router = APIRouter()


def _latest_succeeded_run(conn) -> Dict[str, Any] | None:
    row = conn.execute(
        text(
            """select id, config, demand_source, data_origin_summary, finished_at, git_sha
               from backtest_runs where status = 'succeeded'
               order by finished_at desc nulls last limit 1"""
        )
    ).fetchone()
    if not row:
        return None
    config = row[1] if isinstance(row[1], dict) else {}
    return {
        "run_id": str(row[0]),
        "config": config,
        "demand_source": row[2],
        "data_origin_summary": row[3] if isinstance(row[3], dict) else {},
        "finished_at": row[4].isoformat() if row[4] else None,
        "git_sha": row[5],
    }


def _summary_from_run(conn, run: Dict[str, Any]) -> Dict[str, Any]:
    rows = conn.execute(
        text(
            """select strategy, metric, value, ci_low, ci_high, n_windows
               from backtest_results where run_id = :rid"""
        ),
        {"rid": run["run_id"]},
    ).fetchall()

    by_strategy: Dict[str, Dict[str, Any]] = {}
    for strategy, metric, value, ci_low, ci_high, n_windows in rows:
        by_strategy.setdefault(strategy, {"n_windows": n_windows})[metric] = float(value)
        if metric == "savings_vs_reorder_pct":
            by_strategy[strategy]["savings_ci_low_pct"] = float(ci_low) if ci_low is not None else None
            by_strategy[strategy]["savings_ci_high_pct"] = float(ci_high) if ci_high is not None else None

    strategies = []
    for key, m in by_strategy.items():
        strategies.append({
            "strategy": key,
            "strategy_name": STRATEGY_LABELS.get(key, key),
            "average_cost_inr_per_t": m.get("avg_cost_inr_per_t"),
            "total_spend_inr": m.get("total_spend_inr"),
            "total_procured_t": m.get("total_procured_t"),
            "stockout_weeks": int(m.get("stockout_weeks", 0)),
            "savings_vs_reorder_pct": m.get("savings_vs_reorder_pct"),
            "savings_ci_low_pct": m.get("savings_ci_low_pct"),
            "savings_ci_high_pct": m.get("savings_ci_high_pct"),
            "n_windows": m.get("n_windows"),
        })

    cfg = run["config"]
    test_period = cfg.get("test_period", "unspecified")
    horizon = cfg.get("horizon_weeks")
    n_windows = cfg.get("result", {}).get("n_windows")
    soybuy = next((s for s in strategies if s["strategy"] == "soybuy"), None)

    if soybuy and soybuy.get("savings_vs_reorder_pct") is not None:
        loses = soybuy["savings_vs_reorder_pct"] < 0
        conclusion = (
            f"Walk-forward replay over {test_period} ({n_windows} non-overlapping {horizon}-week "
            f"windows), domestic route, baseline = static reorder-point rule. "
            f"SoyBuy dynamic procurement: {soybuy['savings_vs_reorder_pct']:.2f}% vs baseline "
            f"(95% CI {soybuy.get('savings_ci_low_pct'):.2f}% to {soybuy.get('savings_ci_high_pct'):.2f}%). "
            f"Prices are real (Agmarknet archive); demand is a modelled constant crush "
            f"({cfg.get('result', {}).get('demand_assumption_t_per_week')} t/week). "
            + ("In this window SoyBuy UNDERPERFORMED the baseline."
               if loses else "SoyBuy did not lose to the baseline in this window.")
        )
    else:
        conclusion = "Replay stored, but no savings metric was recorded."

    return {
        "run_id": run["run_id"],
        "test_period": test_period,
        "demand_source": run["demand_source"],
        "data_origin_summary": run["data_origin_summary"],
        "finished_at": run["finished_at"],
        "strategies": strategies,
        "conclusion": conclusion,
    }


@router.get("/backtest/summary")
@router.get("/backtests/summary")
async def get_backtest_summary():
    with get_connection() as conn:
        if conn is None:
            raise BlockedCalculation("DATABASE_UNAVAILABLE", "Database unavailable.",
                                     ["database_unavailable"])
        run = _latest_succeeded_run(conn)
        if run is None:
            raise BlockedCalculation(
                "NO_BACKTEST_RUN",
                "No succeeded historical replay run exists yet.",
                ["no_succeeded_backtest_run", "POST /backtests to generate one"],
            )
        return _summary_from_run(conn, run)


@router.get("/backtests")
async def list_backtest_runs():
    with get_connection() as conn:
        if conn is None:
            return {"items": [], "total": 0}
        rows = conn.execute(
            text("""select id, status, demand_source, queued_at, finished_at
                    from backtest_runs order by queued_at desc limit 50""")
        ).fetchall()
        items = [
            {"run_id": str(r[0]), "status": str(r[1]), "demand_source": r[2],
             "queued_at": r[3].isoformat() if r[3] else None,
             "finished_at": r[4].isoformat() if r[4] else None}
            for r in rows
        ]
        return {"items": items, "total": len(items)}


@router.post("/backtests")
async def start_backtest_run():
    """Run the walk-forward replay on real history and store the results."""
    from app.jobs.backtest_replay import run_and_store_replay

    result = run_and_store_replay()
    with get_connection() as conn:
        run = _latest_succeeded_run(conn)
        return _summary_from_run(conn, run)


@router.get("/backtests/{backtest_id}/results.csv")
async def export_backtest_csv(backtest_id: str):
    with get_connection() as conn:
        if conn is None:
            raise BlockedCalculation("DATABASE_UNAVAILABLE", "Database unavailable.",
                                     ["database_unavailable"])
        rows = conn.execute(
            text("""select window_label, strategy, metric, horizon_week, value, ci_low, ci_high
                    from backtest_results where run_id = :rid
                    order by strategy, metric"""),
            {"rid": backtest_id},
        ).fetchall()
    if not rows:
        raise BlockedCalculation(
            "NO_BACKTEST_RESULTS",
            f"No real results stored for backtest run {backtest_id}.",
            ["no_stored_results"],
        )
    from fastapi.responses import PlainTextResponse
    lines = ["window,strategy,metric,horizon_week,value,ci_low,ci_high"]
    for r in rows:
        lines.append(",".join("" if v is None else str(v) for v in r))
    return PlainTextResponse(content="\n".join(lines), media_type="text/csv")
