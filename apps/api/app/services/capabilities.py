"""
capabilities() — the truth source behind GET /features.

Reports which capabilities are genuinely backed by real data in the database
right now, so the frontend never renders a tab that has nothing real behind it.
"""

from __future__ import annotations

from typing import Any, Dict

from sqlalchemy import text

from app.db import get_connection


def get_capabilities() -> Dict[str, Any]:
    caps: Dict[str, bool] = {
        "forecast": False,
        "landed_cost": False,
        "optimizer": False,
        "scenarios": False,
        "backtest": False,
        "decisions": True,
        "uploads": True,
        "manual_observations": True,
    }
    detail: Dict[str, Any] = {}

    with get_connection() as conn:
        if conn is None:
            return {"capabilities": caps, "detail": detail,
                    "blockers": ["database_unavailable"]}

        def weeks(series_id: str) -> int:
            r = conn.execute(
                text("select count(*) from weekly_prices where series_id = :s and value is not null"),
                {"s": series_id},
            ).fetchone()
            return int(r[0]) if r else 0

        dom = weeks("DOM_SOY_BENCH")
        cbot = weeks("INT_FUT_SOY")
        fx = weeks("FX_USDINR")

        caps["forecast"] = dom >= 52
        # The 12-week landed-cost path is driven by the domestic forecast, so it
        # is only honest when the forecast can actually run.
        caps["landed_cost"] = caps["forecast"] and cbot > 0 and fx > 0
        caps["optimizer"] = caps["forecast"] and caps["landed_cost"]
        caps["scenarios"] = caps["optimizer"]

        r = conn.execute(
            text("select count(*) from backtest_runs where status = 'succeeded'")
        ).fetchone()
        caps["backtest"] = bool(r and r[0] > 0)

        detail["forecast_weeks_available"] = dom
        detail["forecast_weeks_required"] = 52
        detail["daily_observations"] = {
            "DOM_SOY_MANDI": _count(conn, "price_observations", "DOM_SOY_MANDI"),
            "INT_FUT_SOY": _count(conn, "price_observations", "INT_FUT_SOY"),
            "FX_USDINR": _count(conn, "price_observations", "FX_USDINR"),
        }

    blockers = []
    if not caps["forecast"]:
        blockers.append(f"insufficient_history:DOM_SOY_BENCH:{detail['forecast_weeks_available']}_of_52_weeks")
    if not caps["backtest"]:
        blockers.append("no_succeeded_backtest_run")
    return {"capabilities": caps, "detail": detail, "blockers": blockers}


def _count(conn, table: str, series_id: str) -> int:
    r = conn.execute(
        text(f"select count(*) from {table} where series_id = :s"), {"s": series_id}
    ).fetchone()
    return int(r[0]) if r else 0
