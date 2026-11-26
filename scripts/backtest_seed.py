"""
Reproduce the backtest figures published in README.md -> "Validation".

This runs the real walk-forward replay in ``app/services/backtest.py`` over the
real Agmarknet soybean archive shipped in ``data/seed/raw/`` (four yearly CSVs,
2014-2017). Prices are real government mandi modal prices. Demand is a MODELLED
constant weekly crush taken from ``SettingsModel`` defaults and is labelled
``demand_source='synthetic'`` by the replay engine. Domestic route only.

Usage (from the repository root):

    # macOS / Linux
    apps/api/.venv/bin/python scripts/backtest_seed.py

    # Windows
    apps/api\\Scripts\\python.exe scripts/backtest_seed.py
"""

from __future__ import annotations

import datetime
import os
import statistics
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "apps", "api"))

from app.schemas.models import SettingsModel  # noqa: E402
from app.services.adapters.agmarknet_archive import load_archive  # noqa: E402
from app.services.backtest import run_replay  # noqa: E402

SEED_DIR = os.path.join(ROOT, "data", "seed", "raw")
YEARS = [2014, 2015, 2016, 2017]
HORIZON = 12
STEP = 12


def weekly_series(rows):
    """Collapse daily, per-mandi rows to one weekly median price per week."""
    buckets = {}
    for row in rows:
        day = datetime.date.fromisoformat(row["obs_date"])
        week_start = (day - datetime.timedelta(days=day.weekday())).isoformat()
        buckets.setdefault(week_start, []).append(row["value"])
    return [
        {
            "week_start": datetime.date.fromisoformat(week),
            "price": statistics.median(buckets[week]),
        }
        for week in sorted(buckets)
    ]


def main() -> None:
    rows = load_archive(SEED_DIR, YEARS)
    series = weekly_series(rows)
    settings = SettingsModel()

    result = run_replay(series, settings, horizon=HORIZON, step=STEP)

    print(f"daily market rows : {len(rows):,}")
    print(
        f"weekly points     : {len(series)}  "
        f"({series[0]['week_start']} .. {series[-1]['week_start']})"
    )
    print(
        f"windows           : {result['n_windows']} x {result['horizon_weeks']} weeks "
        f"(step {result['step_weeks']})"
    )
    print(
        f"demand            : {result['demand_source']} constant "
        f"{result['demand_assumption_t_per_week']:.0f} t/week"
    )
    print()
    print(
        f"{'strategy':<14}{'total spend (INR)':>20}{'procured (t)':>14}"
        f"{'avg cost (INR/t)':>18}{'stockout weeks':>16}"
    )
    for name, metrics in result["strategies"].items():
        print(
            f"{name:<14}{metrics['total_spend_inr']:>20,.2f}"
            f"{metrics['total_procured_t']:>14,.0f}"
            f"{metrics['avg_cost_inr_per_t']:>18,.2f}"
            f"{metrics['stockout_weeks']:>16}"
        )

    soybuy = result["strategies"]["soybuy"]
    reorder = result["strategies"]["reorder_point"]
    print()
    print(
        f"savings vs reorder_point : {result['savings_pct']:.4f}%  "
        f"95% CI [{result['savings_ci_low_pct']:.4f}%, "
        f"{result['savings_ci_high_pct']:.4f}%]"
    )
    print(f"soybuy_loses_to_baseline : {result['soybuy_loses_to_baseline']}")
    print()
    print("Read this honestly:")
    print(
        f"  - SoyBuy procured {soybuy['total_procured_t'] - reorder['total_procured_t']:+,.0f} t "
        "versus the reorder-point baseline."
    )
    print(
        f"  - Its average cost per tonne was "
        f"{soybuy['avg_cost_inr_per_t'] - reorder['avg_cost_inr_per_t']:+,.2f} INR/t "
        "versus that baseline."
    )
    print(
        "  - A lower total spend with less tonnage is an inventory-drawdown "
        "effect, not proof of cheaper buying."
    )


if __name__ == "__main__":
    main()
