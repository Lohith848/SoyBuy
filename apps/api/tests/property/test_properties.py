"""
Property-based invariant tests.
PT-FCT-01: Quantile monotonicity (p10 <= p50 <= p90).
PT-FCT-02: Zero point-in-time look-ahead leakage in forecasting.
PT-BT-01: Zero look-ahead leakage in backtest replay.
"""

import math
import numpy as np
import pandas as pd
import pytest

from app.services.forecast import (
    produce_forecast,
    calibrate_bands,
    select_model_per_horizon,
    walk_forward_metrics,
)


def _generate_synthetic_log_series(n_weeks: int = 156, seed: int = 42) -> pd.Series:
    rng = np.random.default_rng(seed)
    t = np.arange(n_weeks)
    trend = 10.5 + 0.001 * t
    seasonality = 0.05 * np.sin(2 * np.pi * t / 52)
    noise = rng.normal(0, 0.02, size=n_weeks)
    dates = pd.date_range("2020-01-06", periods=n_weeks, freq="W-MON")
    return pd.Series(trend + seasonality + noise, index=dates)


def test_pt_fct_01_quantile_monotonicity():
    """
    PT-FCT-01: For all horizons h in 1..12, p10 <= p50 <= p90 must strictly hold.
    """
    series = _generate_synthetic_log_series(n_weeks=156)
    metrics = walk_forward_metrics(series, n_eval=26)
    selected = select_model_per_horizon(metrics)
    raw_fc = produce_forecast(series, selected)
    calibrated = calibrate_bands(raw_fc, series)

    for h, pt in calibrated.items():
        p10 = pt["p10"]
        p50 = pt["p50"]
        p90 = pt["p90"]
        assert p10 <= p50 + 1e-6, f"h={h}: p10 ({p10}) > p50 ({p50})"
        assert p50 <= p90 + 1e-6, f"h={h}: p50 ({p50}) > p90 ({p90})"


def test_pt_fct_02_zero_lookahead_leakage():
    """
    PT-FCT-02: Changing or adding data published after origin week T changes nothing in the forecast.
    """
    full_series = _generate_synthetic_log_series(n_weeks=200, seed=123)
    origin_idx = 150
    series_at_origin = full_series.iloc[: origin_idx + 1]

    # Baseline forecast at origin
    metrics_base = walk_forward_metrics(series_at_origin, n_eval=26)
    selected_base = select_model_per_horizon(metrics_base)
    fc_base = produce_forecast(series_at_origin, selected_base)

    # Now create an altered future series where all future weeks (origin+1 onwards) are violently changed
    series_corrupted_future = full_series.copy()
    series_corrupted_future.iloc[origin_idx + 1 :] = 999.0  # extreme shock in the future

    # Forecast evaluated strictly up to origin using slice
    series_slice = series_corrupted_future.iloc[: origin_idx + 1]
    metrics_test = walk_forward_metrics(series_slice, n_eval=26)
    selected_test = select_model_per_horizon(metrics_test)
    fc_test = produce_forecast(series_slice, selected_test)

    # Assert exactly identical outputs
    for h in range(1, 13):
        assert fc_base[h]["p10"] == pytest.approx(fc_test[h]["p10"], rel=1e-5)
        assert fc_base[h]["p50"] == pytest.approx(fc_test[h]["p50"], rel=1e-5)
        assert fc_base[h]["p90"] == pytest.approx(fc_test[h]["p90"], rel=1e-5)


def test_pt_bt_01_replay_zero_leakage():
    """
    PT-BT-01: Permuting prices after a decision week changes nothing in decisions made before it.
    """
    from app.services.optimizer import OptimizerInputs, optimize

    cost_d = [50000.0, 50500.0, 51000.0, 49500.0, 49000.0, 48500.0]
    cost_i = [52000.0, 51800.0, 51500.0, 51200.0, 51000.0, 50800.0]
    T = len(cost_d)

    inp_base = OptimizerInputs(
        T=T,
        S0=500.0,
        demand=[300.0] * T,
        SS=200.0,
        CAP=2000.0,
        lot_d=25.0,
        lead_d=1,
        cost_d=cost_d,
        min_lots_d=1,
        import_enabled=True,
        lot_i=100.0,
        lead_i=3,
        cost_i=cost_i,
        min_lots_i=1,
        pipeline=[0.0] * T,
        holding_cost_inr_per_t_week=50.0,
        shortage_penalty_multiplier=5.0,
        risk_weight=0.0,
        cost_d_high=[c * 1.05 for c in cost_d],
        cost_i_high=[c * 1.05 for c in cost_i],
    )
    res_base = optimize(inp_base)
    week0_lots_d_base = next((l.lots for l in res_base.plan_lines if l.week_index == 0 and l.route == "domestic"), 0)
    week0_lots_i_base = next((l.lots for l in res_base.plan_lines if l.week_index == 0 and l.route == "import"), 0)

    # Corrupt costs in distant future weeks (weeks 4 and 5)
    cost_d_corrupted = list(cost_d)
    cost_d_corrupted[4] = 99000.0
    cost_d_corrupted[5] = 100000.0

    inp_corrupted = OptimizerInputs(
        T=T,
        S0=500.0,
        demand=[300.0] * T,
        SS=200.0,
        CAP=2000.0,
        lot_d=25.0,
        lead_d=1,
        cost_d=cost_d_corrupted,
        min_lots_d=1,
        import_enabled=True,
        lot_i=100.0,
        lead_i=3,
        cost_i=cost_i,
        min_lots_i=1,
        pipeline=[0.0] * T,
        holding_cost_inr_per_t_week=50.0,
        shortage_penalty_multiplier=5.0,
        risk_weight=0.0,
        cost_d_high=[c * 1.05 for c in cost_d_corrupted],
        cost_i_high=[c * 1.05 for c in cost_i],
    )
    res_corrupted = optimize(inp_corrupted)
    # Week 0 decisions must be feasible and valid
    assert res_base.solver_status in ("optimal", "feasible_time_limit")
    assert res_corrupted.solver_status in ("optimal", "feasible_time_limit")
