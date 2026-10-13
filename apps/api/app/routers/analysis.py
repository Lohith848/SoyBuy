"""
Market Analysis API. Spec E.2.

Everything here is computed from real stored weekly_prices. When there is not
enough real history the endpoint returns a blocked response rather than a
hand-written index array.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter
from sqlalchemy import text

from app.db import get_connection
from app.services.blocked import BlockedCalculation

router = APIRouter()

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _weekly(conn, series_id: str) -> List[Dict[str, Any]]:
    rows = conn.execute(
        text(
            """select week_start, value from weekly_prices
               where series_id = :s and value is not null order by week_start"""
        ),
        {"s": series_id},
    ).fetchall()
    return [{"week_start": r[0], "value": float(r[1])} for r in rows]


@router.get("/analysis/seasonality")
async def get_seasonality_analysis():
    with get_connection() as conn:
        if conn is None:
            raise BlockedCalculation("DATABASE_UNAVAILABLE", "Database unavailable.",
                                     ["database_unavailable"])
        series = _weekly(conn, "DOM_SOY_BENCH")

    if len(series) < 104:
        raise BlockedCalculation(
            "INSUFFICIENT_HISTORY",
            f"Seasonality needs at least 104 real weeks of DOM_SOY_BENCH; have {len(series)}.",
            [f"insufficient_history:DOM_SOY_BENCH:{len(series)}_of_104_weeks"],
        )

    overall = sum(p["value"] for p in series) / len(series)
    by_month: Dict[int, List[float]] = {m: [] for m in range(1, 13)}
    for p in series:
        by_month[p["week_start"].month].append(p["value"])

    monthly = []
    for m in range(1, 13):
        vals = by_month[m]
        if not vals:
            continue
        avg = sum(vals) / len(vals)
        monthly.append({
            "month": MONTHS[m - 1],
            "index": round(avg / overall, 3) if overall else None,
            "n_weeks": len(vals),
        })

    lowest = min(monthly, key=lambda x: x["index"]) if monthly else None
    return {
        "source": "computed from real weekly_prices (DOM_SOY_BENCH)",
        "n_weeks_used": len(series),
        "monthly_seasonal_indices": monthly,
        "lowest_price_window": lowest["month"] if lowest else None,
        # Arrival shares require real arrival data, which is not ingested yet.
        "arrival_data_available": False,
        "peak_arrival_window": None,
    }


@router.get("/analysis/cycle")
async def get_cycle_analysis():
    with get_connection() as conn:
        if conn is None:
            return {"available": False, "blockers": ["database_unavailable"]}
        dom = _weekly(conn, "DOM_SOY_BENCH")
        cbot = _weekly(conn, "INT_FUT_SOY")
        fx = _weekly(conn, "FX_USDINR")

    def momentum(series: List[Dict[str, Any]], weeks: int = 4) -> float | None:
        if len(series) <= weeks:
            return None
        last = series[-1]["value"]
        prior = series[-1 - weeks]["value"]
        return round((last - prior) / prior * 100.0, 2) if prior else None

    return {
        "available": True,
        "source": "computed from real weekly_prices",
        "domestic_mandi_momentum_4w_pct": momentum(dom),
        "cbot_momentum_4w_pct": momentum(cbot),
        "current_fx_rate": fx[-1]["value"] if fx else None,
        "domestic_weeks_available": len(dom),
    }
