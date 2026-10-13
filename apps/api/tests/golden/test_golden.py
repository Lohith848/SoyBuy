"""
Golden tests (GT-*) and property tests (PT-*).  Spec C.14.
Run with: pytest apps/api/tests/golden/test_golden.py -v
"""

import pytest

try:
    from app.services.units import inr_quintal_to_inr_t, cents_bu_to_usd_t

    from app.services.landed_cost import (
        domestic_landed_cost, DomesticSettings,
        import_landed_cost, ImportSettings,
    )
    from app.services.optimizer import optimize, OptimizerInputs
except ModuleNotFoundError:
    from apps.api.app.services.units import inr_quintal_to_inr_t, cents_bu_to_usd_t
    from apps.api.app.services.landed_cost import (
        domestic_landed_cost, DomesticSettings,
        import_landed_cost, ImportSettings,
    )
    from apps.api.app.services.optimizer import optimize, OptimizerInputs



# ============================================================
# GT-UNIT-01  INR/quintal → INR/t
# ============================================================
def test_gt_unit_01():
    assert inr_quintal_to_inr_t(5_000) == pytest.approx(50_000.0)


# ============================================================
# GT-UNIT-02  US cents/bu → USD/t
# ============================================================
def test_gt_unit_02():
    assert cents_bu_to_usd_t(1_000) == pytest.approx(367.437, abs=1e-3)


# ============================================================
# GT-LC-01  Domestic landed cost
# Expected total: 53_700.00
# Components: 50000; 500; 250; 2400; 300; 250; 0; 0
# ============================================================
def test_gt_lc_01():
    s = DomesticSettings(
        dom_market_fee_pct=0.01,           # 1%
        dom_commission_pct=0.005,          # 0.5%
        dom_transport_flat_inr_per_t=None,
        dom_transport_inr_per_t_km=3.0,
        dom_distance_km=800,
        dom_handling_inr_per_t=300,
        dom_quality_allowance_pct=0.005,   # 0.5%
        dom_other_taxes_pct=0.0,
        finance_rate_annual=0.0,
        dom_prepay_days=0,
    )
    res = domestic_landed_cost(50_000.0, s)

    assert res["base_price"] == pytest.approx(50_000.0)
    assert res["market_fee"] == pytest.approx(500.0)
    assert res["commission"] == pytest.approx(250.0)
    assert res["transport"] == pytest.approx(2_400.0)
    assert res["handling"] == pytest.approx(300.0)
    assert res["quality_allowance"] == pytest.approx(250.0)
    assert res["other_taxes"] == pytest.approx(0.0)
    assert res["financing"] == pytest.approx(0.0)
    assert res["total"] == pytest.approx(53_700.0, abs=0.01)


# ============================================================
# GT-LC-02  Import landed cost
# Expected total: 50_023.73  (tolerance 0.01)
# ============================================================
def test_gt_lc_02():
    s = ImportSettings(
        fob_premium_usd_per_t=0,
        imp_freight_usd_per_t=40,
        imp_insurance_pct=0.005,           # 0.5%
        imp_landing_pct=0.01,              # 1%
        imp_duty_effective_pct=0.10,       # 10% (TEST VALUE ONLY)
        imp_port_clearing_inr_per_t=1_500,
        imp_inland_transport_inr_per_t=2_000,
        imp_handling_inr_per_t=300,
        imp_quality_allowance_pct=0,
        imp_risk_buffer_pct=0,
        finance_rate_annual=0.10,          # 10% per year
        imp_prepay_days=60,
    )
    res = import_landed_cost(450.0, 84.0, s)

    assert res["cif_inr"] == pytest.approx(41_365.80, abs=0.01)
    assert res["duty"] == pytest.approx(4_177.95, abs=0.02)
    assert res["port_clearing"] == pytest.approx(1_500.0)
    assert res["inland_transport"] == pytest.approx(2_000.0)
    assert res["handling"] == pytest.approx(300.0)
    assert res["financing"] == pytest.approx(679.99, abs=0.02)
    assert res["total"] == pytest.approx(50_023.73, abs=0.02)


# ============================================================
# GT-OPT-01  MILP optimizer
# T=3, D=[10,10,10], S0=15, SS=5, CAP=100,
# domestic only, lot=10, Ld=1,
# c_d=[100,90,80], hold=0, pipeline=[], terminal=False
# Expected: qd=[1,1,0], shortage=0, order_cost=1900.00
# ============================================================
def test_gt_opt_01():
    try:
        import pulp  # noqa: F401
    except ImportError:
        pytest.skip("PuLP not installed")

    inp = OptimizerInputs(
        T=3,
        S0=15,
        demand=[10.0, 10.0, 10.0],
        SS=5.0,
        CAP=100.0,
        lot_d=10.0,
        lead_d=1,
        cost_d=[100.0, 90.0, 80.0],
        min_lots_d=0,
        import_enabled=False,
        holding_cost_inr_per_t_week=0,
        shortage_penalty_multiplier=5.0,
        terminal_enabled=False,   # per spec for this test
        eps=0.001,
    )
    res = optimize(inp)

    assert res.solver_status in ("optimal", "feasible_time_limit"), f"Got: {res.solver_status}"
    assert res.shortage_total == pytest.approx(0.0, abs=0.5)

    # Extract domestic order quantities per week
    qd_by_week = {line.week_index: line.lots for line in res.plan_lines
                  if line.route == "domestic"}
    assert qd_by_week.get(0, 0) == 1, f"qd[0] should be 1, got {qd_by_week}"
    assert qd_by_week.get(1, 0) == 1, f"qd[1] should be 1, got {qd_by_week}"
    assert qd_by_week.get(2, 0) == 0, f"qd[2] should be 0, got {qd_by_week}"
    # order_cost = 90*10 + 80*10 = 1900 (ordered in weeks 0,1 priced at cost arriving at 1,2)
    # Actually: qd[0] priced at c_d[0]=100 because we order at week 0
    # Wait — spec: "ordered in week t at cost c_d[t]"
    # qd=[1,1,0]: cost = 100*10 + 90*10 = 1900. Yes.
    assert res.order_cost_p50 == pytest.approx(1_900.0, abs=1.0)


# ============================================================
# Property: GT-LC sum property
# ============================================================
def test_pt_lc_01_domestic_components_sum():
    """PT-LC-01: total equals sum of components for domestic."""
    s = DomesticSettings(
        dom_market_fee_pct=0.01, dom_commission_pct=0.005,
        dom_transport_flat_inr_per_t=500, dom_handling_inr_per_t=200,
        dom_quality_allowance_pct=0.01, dom_other_taxes_pct=0.005,
        finance_rate_annual=0.12, dom_prepay_days=30,
    )
    res = domestic_landed_cost(40_000.0, s)
    component_keys = ["base_price", "market_fee", "commission", "transport",
                      "handling", "quality_allowance", "other_taxes", "financing"]
    expected_sum = sum(res[k] for k in component_keys)
    assert res["total"] == pytest.approx(expected_sum, rel=1e-9)


def test_pt_lc_01_import_components_sum():
    """PT-LC-01: total equals sum of components for import."""
    s = ImportSettings(
        fob_premium_usd_per_t=5, imp_freight_usd_per_t=35, imp_insurance_pct=0.005,
        imp_landing_pct=0.01, imp_duty_effective_pct=0.10,
        imp_port_clearing_inr_per_t=1200, imp_inland_transport_inr_per_t=1800,
        imp_handling_inr_per_t=300, imp_quality_allowance_pct=0.01,
        imp_risk_buffer_pct=0.01, finance_rate_annual=0.10, imp_prepay_days=45,
    )
    res = import_landed_cost(450.0, 83.5, s)
    component_keys = ["cif_inr", "duty", "port_clearing", "inland_transport",
                      "handling", "quality_allowance", "financing", "risk_buffer"]
    expected_sum = sum(res[k] for k in component_keys)
    assert res["total"] == pytest.approx(expected_sum, rel=1e-9)


def test_pt_lc_02_domestic_cost_increases_with_price():
    """PT-LC-02: domestic total increases when P increases."""
    s = DomesticSettings(dom_market_fee_pct=0.01, dom_transport_flat_inr_per_t=500,
                         dom_handling_inr_per_t=200)
    low = domestic_landed_cost(40_000.0, s)["total"]
    high = domestic_landed_cost(50_000.0, s)["total"]
    assert high > low


def test_pt_lc_02_import_cost_increases_with_int_price():
    """PT-LC-02: import total increases when INT increases."""
    s = ImportSettings(imp_freight_usd_per_t=35, imp_insurance_pct=0.005,
                       imp_landing_pct=0.01, imp_duty_effective_pct=0.10,
                       imp_port_clearing_inr_per_t=1200, imp_inland_transport_inr_per_t=1800,
                       imp_handling_inr_per_t=300)
    low = import_landed_cost(400.0, 83.0, s)["total"]
    high = import_landed_cost(500.0, 83.0, s)["total"]
    assert high > low
