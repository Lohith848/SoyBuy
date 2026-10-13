"""
Walk-forward procurement replay (Master Spec C.10 / §4.5).

Honest by construction:
  - Runs ONLY on real weekly price history (DOM_SOY_BENCH).
  - Never looks ahead: the dynamic strategy's price expectations at each window
    use only prices known at that window's origin (persistence).
  - Demand is a MODELLED constant weekly crush from client settings and is
    labelled demand_source='synthetic' in the run row and the API response.
  - Reports the real result, including when SoyBuy loses to a baseline, with a
    bootstrap 95% confidence interval over per-window savings. No cherry-picking.
  - Domestic route only (documented limitation; import parity replay is pending
    aligned FX/CBOT realised history).
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Dict, List

from app.services.optimizer import OptimizerInputs, optimize


@dataclass
class WindowOutcome:
    origin: date
    spend: Dict[str, float] = field(default_factory=dict)
    procured: Dict[str, float] = field(default_factory=dict)
    stockout_weeks: Dict[str, int] = field(default_factory=dict)


STRATEGIES = ["soybuy", "reorder_point", "buy_as_needed", "oracle"]
STRATEGY_LABELS = {
    "soybuy": "SoyBuy Dynamic (MILP, persistence forecast)",
    "reorder_point": "Static Reorder-Point Rule (baseline)",
    "buy_as_needed": "Buy-As-Needed (JIT)",
    "oracle": "Perfect Foresight (theoretical upper bound)",
}
METRICS = [
    "total_spend_inr",
    "avg_cost_inr_per_t",
    "total_procured_t",
    "stockout_weeks",
    "savings_vs_reorder_pct",
]


def _simulate(
    order_fn: Callable[[int, float, List[float]], float],
    prices: List[float],
    demand_t: float,
    lead: int,
    lot: float,
) -> tuple[float, float, int]:
    """
    Simulate one window for one strategy.

    order_fn(week_index, inventory, known_prices) -> tonnes to order this week.
    Only prices up to and including week_index are passed (no look-ahead) for
    every non-oracle strategy; the oracle is handled separately.
    """
    horizon = len(prices)
    inventory = demand_t * (lead + 1)  # a sane starting stock for the window
    pipeline: Dict[int, float] = {}
    spend = 0.0
    procured = 0.0
    stockouts = 0

    for t in range(horizon):
        inventory += pipeline.pop(t, 0.0)
        qty = max(0.0, order_fn(t, inventory, prices[: t + 1]))
        if qty > 0:
            spend += qty * prices[t]
            procured += qty
            pipeline[t + lead] = pipeline.get(t + lead, 0.0) + qty
        inventory -= demand_t
        if inventory < 0:
            stockouts += 1
            inventory = 0.0

    return spend, procured, stockouts


def _reorder_point(safety: float, demand_t: float, lead: int, lot: float):
    def fn(t: int, inv: float, known: List[float]) -> float:
        trigger = safety + demand_t * lead
        if inv <= trigger:
            need = safety + demand_t * (lead + 1) - inv
            return math.ceil(need / lot) * lot
        return 0.0

    return fn


def _buy_as_needed(demand_t: float, lead: int):
    def fn(t: int, inv: float, known: List[float]) -> float:
        return demand_t  # order this week's need; arrives after lead

    return fn


def _soybuy_milp(settings, horizon: int, last_price: float, demand_t: float,
                 lot: float, safety: float, cap: float, lead: int):
    """Order schedule from the real MILP using a persistence price expectation."""
    inp = OptimizerInputs(
        T=horizon,
        S0=demand_t * (lead + 1),
        demand=[demand_t] * horizon,
        SS=safety,
        CAP=cap,
        lot_d=lot,
        lead_d=lead,
        cost_d=[last_price] * horizon,
        min_lots_d=0,
        import_enabled=False,
        pipeline=[0.0] * horizon,
        holding_cost_inr_per_t_week=settings.holding_cost_inr_per_t_week,
        shortage_penalty_multiplier=settings.shortage_penalty_multiplier,
        risk_weight=0.0,
        terminal_enabled=False,
    )
    res = optimize(inp)
    schedule = {i: 0.0 for i in range(horizon)}
    for line in res.plan_lines:
        schedule[line.week_index] = schedule.get(line.week_index, 0.0) + line.tonnes
    return schedule


def run_replay(
    series: List[Dict[str, Any]],
    settings,
    horizon: int = 12,
    step: int = 12,
) -> Dict[str, Any]:
    """
    Replay non-overlapping windows of `horizon` weeks over a real weekly series.
    Returns aggregate metrics per strategy plus a bootstrap CI on savings.
    """
    prices = [float(p["price"]) for p in series]
    weeks = [p["week_start"] for p in series]
    demand_t = float(settings.weekly_consumption_t)
    safety = float(settings.safety_stock_t)
    cap = float(settings.storage_capacity_t)
    lot = float(settings.dom_lot_size_t)
    lead = int(settings.dom_lead_time_weeks)

    outcomes: List[WindowOutcome] = []

    for origin in range(0, len(prices) - horizon + 1, step):
        window = prices[origin: origin + horizon]
        if len(window) < horizon:
            break
        last_price = prices[origin]  # known at origin (no look-ahead)

        # Pre-compute the MILP schedule for this window (uses origin info only).
        milp_schedule = _soybuy_milp(settings, horizon, last_price, demand_t,
                                     lot, safety, cap, lead)

        row = WindowOutcome(origin=weeks[origin])

        # -- soybuy: follow the MILP schedule, priced at REALISED prices --
        def soybuy_fn(t, inv, known, _sched=milp_schedule):
            return _sched.get(t, 0.0)

        # -- reorder point --
        # -- buy as needed --
        fns = {
            "soybuy": soybuy_fn,
            "reorder_point": _reorder_point(safety, demand_t, lead, lot),
            "buy_as_needed": _buy_as_needed(demand_t, lead),
        }
        for key, fn in fns.items():
            spend, procured, stockouts = _simulate(fn, window, demand_t, lead, lot)
            row.spend[key] = spend
            row.procured[key] = procured
            row.stockout_weeks[key] = stockouts

        # -- oracle: buy the whole window's demand at the cheapest week --
        total_demand = demand_t * horizon
        cheapest = min(window)
        row.spend["oracle"] = total_demand * cheapest
        row.procured["oracle"] = total_demand
        row.stockout_weeks["oracle"] = 0

        outcomes.append(row)

    n_windows = len(outcomes)
    agg: Dict[str, Dict[str, float]] = {}
    for key in STRATEGIES:
        total_spend = sum(o.spend[key] for o in outcomes)
        total_proc = sum(o.procured[key] for o in outcomes)
        stockouts = sum(o.stockout_weeks[key] for o in outcomes)
        agg[key] = {
            "total_spend_inr": round(total_spend, 2),
            "total_procured_t": round(total_proc, 3),
            "avg_cost_inr_per_t": round(total_spend / total_proc, 2) if total_proc > 0 else None,
            "stockout_weeks": stockouts,
        }

    # Savings vs reorder per window, with a bootstrap 95% CI.
    base = "reorder_point"
    base_total = agg[base]["total_spend_inr"]
    per_window_savings_pct = []
    for o in outcomes:
        b = o.spend[base]
        if b > 0:
            per_window_savings_pct.append((b - o.spend["soybuy"]) / b * 100.0)

    savings_pct = (
        (base_total - agg["soybuy"]["total_spend_inr"]) / base_total * 100.0
        if base_total else 0.0
    )
    ci_low, ci_high = _bootstrap_ci(per_window_savings_pct)

    for key in STRATEGIES:
        b = agg[base]["total_spend_inr"]
        if b > 0:
            agg[key]["savings_vs_reorder_pct"] = round(
                (b - agg[key]["total_spend_inr"]) / b * 100.0, 4
            )
        else:
            agg[key]["savings_vs_reorder_pct"] = 0.0

    return {
        "n_windows": n_windows,
        "horizon_weeks": horizon,
        "step_weeks": step,
        "period_start": weeks[0].isoformat() if weeks else None,
        "period_end": weeks[-1].isoformat() if weeks else None,
        "demand_source": "synthetic",
        "demand_assumption_t_per_week": demand_t,
        "strategies": agg,
        "savings_pct": round(savings_pct, 4),
        "savings_ci_low_pct": round(ci_low, 4),
        "savings_ci_high_pct": round(ci_high, 4),
        "soybuy_loses_to_baseline": savings_pct < 0,
    }


def _bootstrap_ci(values: List[float], n_boot: int = 2000, seed: int = 7) -> tuple[float, float]:
    if not values:
        return 0.0, 0.0
    import random

    rng = random.Random(seed)
    n = len(values)
    means = []
    for _ in range(n_boot):
        sample = [values[rng.randrange(n)] for _ in range(n)]
        means.append(sum(sample) / n)
    means.sort()
    lo = means[int(0.025 * n_boot)]
    hi = means[int(0.975 * n_boot)]
    return lo, hi
