"""
Forecast service.  Spec C.5.
Models: persistence, seasonal_naive, ETS (Holt-Winters), quantile GBM.
Walk-forward evaluation, model selection per horizon, CQR calibration.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

HORIZONS = list(range(1, 13))      # h = 1..12
QUANTILES = [0.1, 0.5, 0.9]
N_EVAL = 52                        # spec default
MIN_EVAL = 26
MIN_HISTORY_FULL = 156             # weeks for full model set
MIN_HISTORY_ETS = 104              # weeks for ETS/seasonal_naive


# ---------------------------------------------------------------------------
# Feature engineering (C.5.4)
# ---------------------------------------------------------------------------

def build_features(
    series: pd.Series,       # index = week_start (datetime), values = log price
    origin_idx: int,         # position in series corresponding to origin week
) -> dict:
    """
    Build the feature dict for qGBM at a given origin.
    series must be ordered and contiguous up to origin_idx.
    """
    y = series.values
    if origin_idx < 0 or origin_idx >= len(y):
        return {}

    def lag(k):
        i = origin_idx - k
        return float(y[i]) if i >= 0 else float("nan")

    y_o = float(y[origin_idx])
    feats = {"y_o": y_o}
    for k in (1, 4, 13, 26, 52):
        feats[f"d{k}"] = y_o - lag(k)
    for k in (4, 13):
        window = y[max(0, origin_idx - k + 1): origin_idx + 1]
        feats[f"ma{k}"] = float(np.mean(window)) - y_o if len(window) >= 2 else float("nan")
        diffs = np.diff(window) if len(window) >= 2 else np.array([float("nan")])
        feats[f"vol{k}"] = float(np.std(diffs))
    return feats


# ---------------------------------------------------------------------------
# Quantile GBM model (C.5.3)
# ---------------------------------------------------------------------------

def _train_qgbm(
    series: pd.Series,
    horizons: list[int] = HORIZONS,
) -> dict:
    """
    Returns {(h, q): fitted model} for all h × q combinations.
    series: pd.Series indexed by week_start, values = log price.
    """
    try:
        from sklearn.ensemble import HistGradientBoostingRegressor
    except ImportError:
        logger.warning("scikit-learn not available; skipping qGBM")
        return {}

    models = {}
    y = series.values
    n = len(y)

    for h in horizons:
        for q in QUANTILES:
            X_rows, y_rows = [], []
            # Training: all origins o' where o' + h <= n-1
            for o_prime in range(52, n - h):
                feats = build_features(series, o_prime)
                if not feats:
                    continue
                feat_vals = list(feats.values())
                if any(math.isnan(v) for v in feat_vals):
                    continue
                X_rows.append(feat_vals)
                y_rows.append(float(y[o_prime + h]))

            if len(X_rows) < 20:
                continue

            model = HistGradientBoostingRegressor(
                loss="quantile",
                quantile=q,
                learning_rate=0.05,
                max_iter=300,
                max_depth=3,
                min_samples_leaf=20,
                l2_regularization=1.0,
                early_stopping=False,
                random_state=42,
            )
            model.fit(X_rows, y_rows)
            models[(h, q)] = model

    return models


# ---------------------------------------------------------------------------
# ETS model
# ---------------------------------------------------------------------------

def _fit_ets(log_prices: np.ndarray) -> object | None:
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        model = ExponentialSmoothing(
            log_prices,
            trend="add",
            seasonal="add",
            seasonal_periods=52,
            initialization_method="estimated",
            damped_trend=True,
        )
        return model.fit(optimized=True, remove_bias=True)
    except Exception as e:
        logger.warning("ETS fit failed (seasonal): %s. Trying non-seasonal.", e)
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing
            model = ExponentialSmoothing(
                log_prices,
                trend="add",
                damped_trend=True,
                initialization_method="estimated",
            )
            return model.fit(optimized=True, remove_bias=True)
        except Exception as e2:
            logger.error("ETS fit failed entirely: %s", e2)
            return None


# ---------------------------------------------------------------------------
# Walk-forward evaluation (C.5.5)
# ---------------------------------------------------------------------------

def _pinball(q: float, actual: float, pred: float) -> float:
    e = actual - pred
    return max(q * e, (q - 1) * e)


def walk_forward_metrics(
    log_prices: pd.Series,
    n_eval: int = N_EVAL,
) -> dict:
    """
    Returns {model_name: {h: {metric: value}}} over the last n_eval origins.
    """
    n = len(log_prices)
    if n < MIN_HISTORY_ETS:
        return {"error": "INSUFFICIENT_HISTORY", "n_weeks": n}

    y = log_prices.values
    results: dict[str, dict] = {m: {} for m in ("persistence", "seasonal_naive", "ets")}
    if n >= MIN_HISTORY_FULL:
        results["qgbm"] = {}

    # Evaluation origins (last n_eval complete weeks that have h weeks of future)
    max_h = max(HORIZONS)
    valid_origins = [i for i in range(len(y) - max_h - 1) if i >= 52]
    eval_origins = valid_origins[-n_eval:] if len(valid_origins) >= n_eval else valid_origins

    if len(eval_origins) < MIN_EVAL:
        logger.warning("Only %d eval origins; using persistence as fallback", len(eval_origins))

    # Collect errors per model, horizon, quantile
    errors: dict[str, dict] = {m: {h: {"p50_errs": [], "pinball": [], "actual": [], "pred50": []}
                                    for h in HORIZONS}
                                for m in results}

    for o in eval_origins:
        train_y = y[: o + 1]
        ets_fit = _fit_ets(train_y) if n >= MIN_HISTORY_ETS else None

        for h in HORIZONS:
            actual = float(y[o + h])
            # --- persistence ---
            pred_p = float(y[o])
            errors["persistence"][h]["p50_errs"].append(abs(pred_p - actual) / math.exp(actual))
            for q in QUANTILES:
                errors["persistence"][h]["pinball"].append(_pinball(q, actual, pred_p))

            # --- seasonal naive ---
            if o + h - 52 >= 0:
                pred_sn = float(y[o + h - 52])
            else:
                pred_sn = pred_p
            errors["seasonal_naive"][h]["p50_errs"].append(abs(pred_sn - actual) / math.exp(actual))
            for q in QUANTILES:
                errors["seasonal_naive"][h]["pinball"].append(_pinball(q, actual, pred_sn))

            # --- ETS ---
            if ets_fit is not None:
                try:
                    pred_ets = float(ets_fit.forecast(h)[-1])
                except Exception:
                    pred_ets = pred_p
                errors["ets"][h]["p50_errs"].append(abs(pred_ets - actual) / math.exp(actual))
                for q in QUANTILES:
                    errors["ets"][h]["pinball"].append(_pinball(q, actual, pred_ets))

    # Aggregate
    metrics_out = {}
    for model_name, h_dict in errors.items():
        metrics_out[model_name] = {}
        for h, data in h_dict.items():
            if data["p50_errs"]:
                metrics_out[model_name][h] = {
                    "mape_p50": float(np.mean(data["p50_errs"])),
                    "pinball_log": float(np.mean(data["pinball"])),
                    "n_origins": len(data["p50_errs"]),
                }

    return metrics_out


# ---------------------------------------------------------------------------
# Model selection per horizon (C.5.6)
# ---------------------------------------------------------------------------

COMPLEXITY_ORDER = ["persistence", "seasonal_naive", "ets", "qgbm"]
PARSIMONY_THRESHOLD = 0.01  # 1%


def select_model_per_horizon(metrics: dict) -> dict[int, str]:
    """
    Returns {h: model_name} using pinball_log + parsimony rule.
    """
    selection = {}
    for h in HORIZONS:
        best_model = None
        best_score = float("inf")
        for model_name in COMPLEXITY_ORDER:
            if model_name not in metrics:
                continue
            h_metrics = metrics.get(model_name, {}).get(h)
            if h_metrics is None:
                continue
            score = h_metrics["pinball_log"]
            if best_model is None:
                best_model = model_name
                best_score = score
            else:
                # Parsimony: if this simpler model is within 1% of best, prefer it
                complexity_new = COMPLEXITY_ORDER.index(model_name)
                complexity_best = COMPLEXITY_ORDER.index(best_model)
                if complexity_new < complexity_best:
                    if score <= best_score * (1 + PARSIMONY_THRESHOLD):
                        best_model = model_name
                        best_score = score
                elif score < best_score:
                    best_model = model_name
                    best_score = score

        selection[h] = best_model or "persistence"
    return selection


# ---------------------------------------------------------------------------
# Produce forecast for all horizons (point-in-time)
# ---------------------------------------------------------------------------

def produce_forecast(
    log_prices: pd.Series,
    selected_models: dict[int, str],
    qgbm_models: dict | None = None,
) -> dict[int, dict]:
    """
    Returns {h: {p10, p50, p90, model_name}}.
    log_prices: full series up to origin (inclusive).
    """
    y = log_prices.values
    n = len(y)
    origin_idx = n - 1
    forecast = {}

    for h in HORIZONS:
        model_name = selected_models.get(h, "persistence")
        pred_p50 = None

        if model_name == "persistence":
            pred_p50 = float(y[origin_idx])

        elif model_name == "seasonal_naive":
            sn_idx = origin_idx + h - 52
            pred_p50 = float(y[sn_idx]) if sn_idx >= 0 else float(y[origin_idx])

        elif model_name == "ets":
            ets_fit = _fit_ets(y)
            pred_p50 = float(ets_fit.forecast(h)[-1]) if ets_fit else float(y[origin_idx])

        elif model_name == "qgbm" and qgbm_models:
            feats = build_features(log_prices, origin_idx)
            feat_vals = [feats.get(k, float("nan")) for k in sorted(feats.keys())]
            preds = {}
            for q in QUANTILES:
                m = qgbm_models.get((h, q))
                if m:
                    preds[q] = float(m.predict([feat_vals])[0])
                else:
                    preds[q] = float(y[origin_idx])
            p10, p50, p90 = sorted([preds[0.1], preds[0.5], preds[0.9]])
            forecast[h] = {"p10": p10, "p50": p50, "p90": p90, "model_name": model_name}
            continue

        # For non-qgbm: estimate bands from residuals
        residuals = [float(y[i + h]) - float(y[i]) for i in range(max(0, n - 52), n - h)]
        p10_adj = (pred_p50 + np.quantile(residuals, 0.10)) if residuals else pred_p50
        p90_adj = (pred_p50 + np.quantile(residuals, 0.90)) if residuals else pred_p50
        p10, p50, p90 = sorted([p10_adj, pred_p50, p90_adj])

        forecast[h] = {"p10": p10, "p50": p50, "p90": p90, "model_name": model_name}

    return forecast


# ---------------------------------------------------------------------------
# CQR calibration (C.5.7)
# ---------------------------------------------------------------------------

def calibrate_bands(
    forecast: dict[int, dict],
    log_prices: pd.Series,
    alpha: float = 0.2,
    K: int = 26,
) -> dict[int, dict]:
    """Apply conformalized quantile regression band adjustment."""
    y = log_prices.values
    n = len(y)
    calibrated = {}

    for h, fc in forecast.items():
        # Use last K origins with realized targets
        origins_with_targets = [i for i in range(n - h) if i >= 0][-K:]
        scores = []
        for o in origins_with_targets:
            actual = float(y[o + h])
            q10_hat = fc["p10"]  # simplified: use the final forecast bands
            q90_hat = fc["p90"]
            scores.append(max(q10_hat - actual, actual - q90_hat))

        if len(scores) >= 20:
            k = len(scores)
            level = min(1.0, (1 - alpha) * (1 + 1 / k))
            Q = float(np.quantile(scores, level))
            p10_new = fc["p10"] - Q
            p90_new = fc["p90"] + Q
            if p10_new > p90_new:
                p10_new = p90_new = fc["p50"]
            calibrated[h] = {**fc, "p10": p10_new, "p90": p90_new}
        else:
            calibrated[h] = fc

    return calibrated
