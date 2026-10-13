"""
Buy-plan optimizer.  Spec C.7 – Mixed-Integer Linear Program via PuLP/CBC.
Pure function: inputs in, plan out.  No I/O.

GT-OPT-01:
  T=3, D=[10,10,10], S0=15, SS=5, CAP=100, domestic only,
  lot=10, Ld=1, c_d=[100,90,80], hold=0, pipeline=[], terminal=False
  → qd=[1,1,0], shortage=0, order_cost=1_900.00
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

try:
    from pulp import (
        LpProblem, LpMinimize, LpVariable, LpInteger, LpBinary, LpStatus,
        lpSum, value, PULP_CBC_CMD,
    )
    _PULP_OK = True
except ImportError:
    _PULP_OK = False


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class OptimizerInputs:
    T: int                        # horizon weeks (≤12)
    S0: float                     # starting stock tonnes
    demand: list[float]           # D[t] tonnes per week
    SS: float                     # safety stock tonnes
    CAP: float                    # storage capacity tonnes
    # Domestic
    lot_d: float                  # lot size tonnes
    lead_d: int                   # lead weeks (ceil(lead_days/7))
    cost_d: list[float]           # landed cost INR/t per week (likely path)
    min_lots_d: int = 0
    # Import
    import_enabled: bool = False
    lot_i: float = 0.0
    lead_i: int = 0
    cost_i: list[float] = field(default_factory=list)
    min_lots_i: int = 0
    # Pipeline: tonnes arriving in week t from open orders
    pipeline: list[float] = field(default_factory=list)
    # Costs
    holding_cost_inr_per_t_week: float = 0.0
    shortage_penalty_multiplier: float = 5.0
    risk_weight: float = 0.0       # 0 = likely path; blends with high path (C.7.4)
    cost_d_high: list[float] = field(default_factory=list)
    cost_i_high: list[float] = field(default_factory=list)
    # Solver
    solver_time_limit_s: int = 20
    solver_gap_rel: float = 0.01
    terminal_enabled: bool = True   # set False for GT-OPT-01
    eps: float = 0.001              # tie-break weight INR/t per week index


@dataclass
class PlanLine:
    week_index: int
    route: str          # 'domestic' or 'import'
    lots: int
    tonnes: float
    unit_cost_p50: float


@dataclass
class OptimizerResult:
    solver_status: str          # 'optimal', 'feasible_time_limit', 'fallback'
    fallback: bool
    objective_value: float
    plan_lines: list[PlanLine]
    inv: list[float]            # projected end-of-week stock
    short: list[float]          # shortage per week
    shortage_total: float
    order_cost_p50: float       # total procurement cost on likely path
    order_cost_low: float       # same plan, low-path prices
    order_cost_high: float      # same plan, high-path prices
    binding_capacity: list[int]
    binding_minorder: list[int]
    error_code: Optional[str] = None


# ---------------------------------------------------------------------------
# Pre-checks (C.7.5)
# ---------------------------------------------------------------------------

PRECHECKS = [
    ("S0 > CAP",    "INITIAL_STOCK_EXCEEDS_CAPACITY"),
    ("SS > CAP",    "SAFETY_EXCEEDS_CAPACITY"),
    ("lot_d == 0",  "LOT_SIZE_MISSING"),
    ("lead_d < 0",  "LEAD_TIME_MISSING"),
]


def _precheck(inp: OptimizerInputs) -> Optional[str]:
    if inp.S0 > inp.CAP:
        return "INITIAL_STOCK_EXCEEDS_CAPACITY"
    if inp.SS > inp.CAP:
        return "SAFETY_EXCEEDS_CAPACITY"
    if inp.lot_d <= 0:
        return "LOT_SIZE_MISSING"
    if not inp.demand:
        return "CONSUMPTION_MISSING"
    return None


# ---------------------------------------------------------------------------
# Cost path helper (C.7.4)
# ---------------------------------------------------------------------------

def _effective_cost(likely: list[float], high: list[float], w: float) -> list[float]:
    if not high or w == 0:
        return likely
    return [(1 - w) * l + w * h for l, h in zip(likely, high)]


# ---------------------------------------------------------------------------
# Fallback heuristic (C.7.7)
# ---------------------------------------------------------------------------

def _fallback_plan(inp: OptimizerInputs) -> OptimizerResult:
    """Reorder-point rule used when MILP fails or is infeasible."""
    T = inp.T
    pipeline = list(inp.pipeline) + [0.0] * T
    inv = inp.S0
    plan_lines: list[PlanLine] = []
    inv_path = []
    short_path = []
    order_cost = 0.0

    for t in range(T):
        # project stock at t + L
        L = inp.lead_d
        proj = inv + sum(pipeline[t: t + L + 1])
        proj -= sum(inp.demand[t: t + L + 1])
        target = inp.SS + (inp.demand[t] if t < T else 0)
        if proj < target:
            shortage_gap = target - proj
            lots = max(inp.min_lots_d, math.ceil(shortage_gap / inp.lot_d))
            order_t = lots * inp.lot_d
            if t + L < T:
                pipeline[t + L] = pipeline[t + L] + order_t
            c = inp.cost_d[t] if t < len(inp.cost_d) else 0.0
            order_cost += c * order_t
            plan_lines.append(PlanLine(t, "domestic", lots, order_t, c))

        inv += pipeline[t] - inp.demand[t]
        short_t = max(0.0, inp.SS - inv)
        short_path.append(short_t)
        inv_path.append(inv)

    return OptimizerResult(
        solver_status="fallback",
        fallback=True,
        objective_value=order_cost,
        plan_lines=plan_lines,
        inv=inv_path,
        short=short_path,
        shortage_total=sum(short_path),
        order_cost_p50=order_cost,
        order_cost_low=order_cost,
        order_cost_high=order_cost,
        binding_capacity=[],
        binding_minorder=[],
    )


# ---------------------------------------------------------------------------
# Main optimizer (C.7.2 / C.7.3)
# ---------------------------------------------------------------------------

def optimize(inp: OptimizerInputs) -> OptimizerResult:
    """
    Solve the buy-plan MILP.  Returns an OptimizerResult.
    Falls back to the heuristic if PULP is unavailable or the solve fails.
    """
    err = _precheck(inp)
    if err:
        return OptimizerResult(
            solver_status="fallback", fallback=True, objective_value=0,
            plan_lines=[], inv=[], short=[], shortage_total=0,
            order_cost_p50=0, order_cost_low=0, order_cost_high=0,
            binding_capacity=[], binding_minorder=[], error_code=err,
        )

    if not _PULP_OK:
        return _fallback_plan(inp)

    T = inp.T
    pipeline = list(inp.pipeline) + [0.0] * T
    c_d = _effective_cost(inp.cost_d, inp.cost_d_high, inp.risk_weight)
    c_i = _effective_cost(inp.cost_i, inp.cost_i_high, inp.risk_weight) if inp.import_enabled else []

    # Penalty: shortage_penalty_multiplier × max cost
    all_costs = c_d + (c_i or [])
    P_short = inp.shortage_penalty_multiplier * (max(all_costs) if all_costs else 1_000_000.0)

    # Terminal target (C.7.1)
    mean_d = sum(inp.demand) / T if T else 0
    L_max = max(inp.lead_d, inp.lead_i if inp.import_enabled else 0)
    TERM = L_max * mean_d if inp.terminal_enabled else 0.0

    max_lots_d = math.ceil(inp.CAP / inp.lot_d) if inp.lot_d > 0 else 1
    max_lots_i = math.ceil(inp.CAP / inp.lot_i) if inp.import_enabled and inp.lot_i > 0 else 0

    m = LpProblem("soybuy_plan", LpMinimize)

    qd = [LpVariable(f"qd_{t}", lowBound=0, cat=LpInteger) for t in range(T)]
    yd = [LpVariable(f"yd_{t}", cat=LpBinary) for t in range(T)]
    inv = [LpVariable(f"inv_{t}", cat="Continuous") for t in range(T)]
    invp = [LpVariable(f"invp_{t}", lowBound=0, cat="Continuous") for t in range(T)]
    short = [LpVariable(f"short_{t}", lowBound=0, cat="Continuous") for t in range(T)]
    shortT = LpVariable("shortT", lowBound=0, cat="Continuous")

    if inp.import_enabled:
        qi = [LpVariable(f"qi_{t}", lowBound=0, cat=LpInteger) for t in range(T)]
        yi = [LpVariable(f"yi_{t}", cat=LpBinary) for t in range(T)]
    else:
        qi = [0] * T
        yi = [0] * T

    # --- Constraints ---
    for t in range(T):
        prev_inv = inp.S0 if t == 0 else inv[t - 1]
        arr = pipeline[t]
        dom_arr = inp.lot_d * qd[t - inp.lead_d] if t - inp.lead_d >= 0 else 0
        imp_arr = (inp.lot_i * qi[t - inp.lead_i]
                   if inp.import_enabled and t - inp.lead_i >= 0 else 0)

        m += inv[t] == prev_inv + arr + dom_arr + imp_arr - inp.demand[t]
        m += inv[t] + short[t] >= inp.SS
        m += inv[t] <= inp.CAP
        m += invp[t] >= inv[t]

        # Min / max lots per route
        m += qd[t] >= inp.min_lots_d * yd[t]
        m += qd[t] <= max_lots_d * yd[t]

        if inp.import_enabled:
            m += qi[t] >= inp.min_lots_i * yi[t]
            m += qi[t] <= max_lots_i * yi[t]

    # Terminal soft constraint
    if inp.terminal_enabled:
        m += inv[T - 1] + shortT >= inp.SS + TERM

    # Objective
    obj = (
        lpSum(inp.lot_d * c_d[t] * qd[t] for t in range(T))
        + (lpSum(inp.lot_i * c_i[t] * qi[t] for t in range(T)) if inp.import_enabled else 0)
        + inp.holding_cost_inr_per_t_week * lpSum(invp)
        + P_short * (lpSum(short) + shortT)
        + inp.eps * lpSum(t * inp.lot_d * qd[t] for t in range(T))
    )
    m += obj

    solver = PULP_CBC_CMD(
        msg=0,
        timeLimit=inp.solver_time_limit_s,
        gapRel=inp.solver_gap_rel,
    )
    status = m.solve(solver)
    status_str = LpStatus[m.status]

    if status_str not in ("Optimal", "Not Solved") and m.status == 1:
        status_str = "Optimal"

    if m.status not in (1,):
        # Infeasible or error → fallback
        return _fallback_plan(inp)

    solver_label = "optimal" if status_str == "Optimal" else "feasible_time_limit"

    # Extract solution
    qd_vals = [int(round(value(qd[t]) or 0)) for t in range(T)]
    qi_vals = [int(round(value(qi[t]) or 0)) if inp.import_enabled else 0 for t in range(T)]
    inv_vals = [float(value(inv[t]) or 0) for t in range(T)]
    short_vals = [float(value(short[t]) or 0) for t in range(T)]

    plan_lines: list[PlanLine] = []
    for t in range(T):
        if qd_vals[t] > 0:
            plan_lines.append(PlanLine(t, "domestic", qd_vals[t],
                                       qd_vals[t] * inp.lot_d, c_d[t]))
        if inp.import_enabled and qi_vals[t] > 0:
            plan_lines.append(PlanLine(t, "import", qi_vals[t],
                                       qi_vals[t] * inp.lot_i, c_i[t]))

    # Re-price on low and high paths (same quantities)
    def _reprice(cost_d_path: list[float], cost_i_path: list[float]) -> float:
        total = sum(inp.lot_d * cost_d_path[t] * qd_vals[t] for t in range(T))
        if inp.import_enabled:
            total += sum(inp.lot_i * cost_i_path[t] * qi_vals[t] for t in range(T))
        return total

    order_cost_p50 = _reprice(inp.cost_d, inp.cost_i)
    order_cost_low = _reprice(
        inp.cost_d if not inp.cost_d_high else
        [min(a, b) for a, b in zip(inp.cost_d, inp.cost_d_high)],
        inp.cost_i,
    )
    order_cost_high = _reprice(
        inp.cost_d_high or inp.cost_d,
        inp.cost_i_high or inp.cost_i,
    )

    # Binding flags
    binding_cap = [t for t in range(T) if abs(inv_vals[t] - inp.CAP) < 0.5]
    binding_min = [t for t in range(T) if qd_vals[t] > 0 and qd_vals[t] == inp.min_lots_d]

    return OptimizerResult(
        solver_status=solver_label,
        fallback=False,
        objective_value=float(value(m.objective) or 0),
        plan_lines=plan_lines,
        inv=inv_vals,
        short=short_vals,
        shortage_total=sum(short_vals),
        order_cost_p50=order_cost_p50,
        order_cost_low=order_cost_low,
        order_cost_high=order_cost_high,
        binding_capacity=binding_cap,
        binding_minorder=binding_min,
    )
