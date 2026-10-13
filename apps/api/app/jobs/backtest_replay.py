"""
Run + persist the walk-forward replay on real weekly history.

Stores one backtest_runs row (demand_source='synthetic', clearly labelled) and
one backtest_results row per (strategy, metric).
"""

from __future__ import annotations

import json
import os
import uuid
import logging
from typing import Any, Dict, List

import psycopg2
from dotenv import load_dotenv
from sqlalchemy import text

from app.db import get_connection
from app.repositories.settings import get_active_settings
from app.services.backtest import run_replay, STRATEGIES, STRATEGY_LABELS

load_dotenv()
logger = logging.getLogger(__name__)

# Real contiguous historical block. The Agmarknet archive ends mid-2017; the
# 2026 live day is excluded from the replay to avoid a multi-year gap.
HISTORY_END = "2017-06-30"


def _load_real_series() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                select week_start, value from weekly_prices
                where series_id = 'DOM_SOY_BENCH' and value is not null
                  and week_start <= :end
                order by week_start
            """),
            {"end": HISTORY_END},
        ).fetchall()
        return [{"week_start": r[0], "price": float(r[1])} for r in rows]


def run_and_store_replay(horizon: int = 12, step: int = 12) -> Dict[str, Any]:
    series = _load_real_series()
    if len(series) < horizon * 2:
        raise RuntimeError(f"Not enough real weekly history to replay: {len(series)} weeks")

    settings, _sources, settings_version_id, _vno = get_active_settings()

    result = run_replay(series, settings, horizon=horizon, step=step)

    run_id = str(uuid.uuid4())
    config = {
        "horizon_weeks": horizon,
        "step_weeks": step,
        "test_period": f"{result['period_start']} to {result['period_end']}",
        "baseline": "reorder_point",
        "route_scope": "domestic",
        "strategies": STRATEGIES,
        "strategy_labels": STRATEGY_LABELS,
        "result": result,
    }
    data_origin_summary = {
        "prices": "public (real Agmarknet archive weekly DOM_SOY_BENCH)",
        "demand": "synthetic (modelled constant weekly crush from settings)",
        "settings_version_id": settings_version_id,
    }

    with get_connection() as conn:
        if conn is None:
            raise RuntimeError("Database unavailable")

        conn.execute(
            text("""
                insert into backtest_runs
                  (id, status, config, demand_source, finished_at, data_origin_summary,
                   library_versions, git_sha)
                values
                  (:id, 'succeeded', cast(:config as jsonb), 'synthetic', now(),
                   cast(:origin as jsonb), cast(:libs as jsonb), :git_sha)
            """),
            {
                "id": run_id,
                "config": json.dumps(config),
                "origin": json.dumps(data_origin_summary),
                "libs": json.dumps({"note": "tier-1 numpy/statistics only"}),
                "git_sha": os.getenv("GIT_SHA", "dev"),
            },
        )

        for strategy in STRATEGIES:
            metrics = result["strategies"][strategy]
            for metric, value in metrics.items():
                ci_low = ci_high = None
                if metric == "savings_vs_reorder_pct":
                    ci_low = result["savings_ci_low_pct"]
                    ci_high = result["savings_ci_high_pct"]
                conn.execute(
                    text("""
                        insert into backtest_results
                          (run_id, window_label, strategy, metric, horizon_week, value, ci_low, ci_high, n_windows)
                        values
                          (:rid, 'all', :strategy, :metric, 0, :value, :ci_low, :ci_high, :n)
                        on conflict (run_id, window_label, strategy, metric, horizon_week) do update
                          set value = excluded.value, ci_low = excluded.ci_low,
                              ci_high = excluded.ci_high, n_windows = excluded.n_windows
                    """),
                    {
                        "rid": run_id, "strategy": strategy, "metric": metric,
                        "value": value, "ci_low": ci_low, "ci_high": ci_high,
                        "n": result["n_windows"],
                    },
                )

    logger.info("backtest run %s stored: %d windows", run_id, result["n_windows"])
    return {"run_id": run_id, **result}
