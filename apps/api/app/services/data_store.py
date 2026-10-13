"""
Real database-backed state store for SoyBuy.
All public series, settings, forecasts, buy plans, recommendations, and decisions
are persisted in and retrieved from PostgreSQL (Supabase).
Synthetic generation and fake mock data are completely eliminated (DR-1, DR-2, DR-9).
"""

from __future__ import annotations

import datetime
from datetime import date, timedelta
import math
import logging
from typing import Any, Dict, List, Optional
import uuid
import numpy as np
import pandas as pd

from app.schemas.models import (
    SettingsModel,
    ForecastResult,
    ForecastHorizonPoint,
    BuyPlanResult,
    PlanLineItem,
    RecommendationResponse,
    ReasonFact,
    DecisionRecord,
    BacktestSummary,
    StrategyMetrics,
)
from app.repositories.settings import get_active_settings, save_settings, list_settings_versions
from app.repositories.prices import get_weekly_prices, get_latest_weekly_price, get_series_status
from app.repositories.plans import save_plan_run, get_latest_plan_run, get_plan_run_by_id
from app.repositories.recommendations import (
    save_recommendation,
    get_latest_recommendation,
    get_recommendation_by_id,
    list_recommendations,
)
from app.repositories.decisions import record_decision, list_decisions, get_decision_by_id
from app.repositories.forecasts import save_forecast_run, get_latest_forecast
from app.services.landed_cost import (
    DomesticSettings,
    ImportSettings,
    domestic_landed_cost,
    import_landed_cost,
)
from app.services.optimizer import (
    OptimizerInputs,
    optimize,
)
from app.services.explain import (
    ExplainFacts,
    explain,
)
from app.services.forecast import (
    walk_forward_metrics,
    select_model_per_horizon,
    produce_forecast,
    calibrate_bands,
)
from app.services.blocked import BlockedCalculation

logger = logging.getLogger(__name__)


class SoyBuyDataStore:
    def __init__(self):
        # Ephemeral run cache for performance; ground truth is always in DB
        self.cached_forecast: Optional[ForecastResult] = None
        self.cached_plan: Optional[BuyPlanResult] = None
        self.latest_rec_id: Optional[str] = None

    @property
    def settings(self) -> SettingsModel:
        model, _, _, _ = get_active_settings()
        return model

    @property
    def settings_versions(self) -> List[Any]:
        return list_settings_versions()

    @property
    def current_week_start(self) -> date:
        today = date.today()
        return today - timedelta(days=today.weekday())

    @property
    def forecast_origin(self) -> date:
        """Anchor forecasts/plans to the last REAL week we actually have, so the
        week labels reflect the data, not 'today'. Falls back to this week only
        when the series is genuinely empty."""
        rows = get_weekly_prices("DOM_SOY_BENCH")
        if rows:
            return date.fromisoformat(str(rows[-1]["week_start"]))
        return self.current_week_start

    @property
    def history_domestic(self) -> List[Dict[str, Any]]:
        rows = get_weekly_prices("DOM_SOY_BENCH")
        return [
            {
                "series_id": "DOM_SOY_BENCH",
                "week_start": r["week_start"],
                "price": r["value"],
                "unit": "INR/t",
                "source": "Agmarknet Benchmark",
            }
            for r in rows
        ]

    @property
    def history_cbot(self) -> List[Dict[str, Any]]:
        rows = get_weekly_prices("INT_FUT_SOY")
        return [
            {
                "series_id": "INT_FUT_SOY",
                "week_start": r["week_start"],
                "price": r["value"],
                "unit": "USD/t",
                "source": "CBOT nearby",
            }
            for r in rows
        ]

    @property
    def history_fx(self) -> List[Dict[str, Any]]:
        rows = get_weekly_prices("FX_USDINR")
        return [
            {
                "series_id": "FX_USDINR",
                "week_start": r["week_start"],
                "price": r["value"],
                "unit": "INR per USD",
                "source": "RBI Reference Rate",
            }
            for r in rows
        ]

    @property
    def decisions(self) -> List[Any]:
        raw_list = list_decisions()
        records = []
        for d in raw_list:
            dec_at = d.get("decided_at")
            if isinstance(dec_at, str):
                try:
                    dec_at = datetime.datetime.fromisoformat(dec_at.replace("Z", "+00:00"))
                except Exception:
                    dec_at = datetime.datetime.utcnow()
            records.append(
                DecisionRecord(
                    id=d["id"],
                    recommendation_id=d.get("recommendation_id") or "",
                    action=d["action"],
                    decided_by=d.get("decided_by", "Lead Buyer"),
                    decided_at=dec_at or datetime.datetime.utcnow(),
                    note=d.get("note"),
                    modified_quantities_t=d.get("modified_lines"),
                )
            )
        return records

    @property
    def recommendations(self) -> Dict[str, Any]:
        latest = get_latest_recommendation()
        if not latest:
            return {}
        rec_id = latest.get("id")
        return {rec_id: self._dict_to_rec_response(latest)}

    def _dict_to_rec_response(self, d: Dict[str, Any]) -> RecommendationResponse:
        reasons_raw = d.get("reasons", [])
        reasons = []
        for r in reasons_raw:
            if isinstance(r, dict):
                reasons.append(ReasonFact(id=r.get("id", "r"), text=r.get("text", ""), fact_refs=r.get("fact_refs", [])))
            else:
                reasons.append(ReasonFact(id="r", text=str(r), fact_refs=[]))

        buy_plan_raw = d.get("buy_plan")
        plan_obj = None
        if buy_plan_raw and isinstance(buy_plan_raw, dict):
            lines = []
            for item in buy_plan_raw.get("plan_lines", []):
                w_dt = item.get("week_start")
                if isinstance(w_dt, str):
                    w_dt = date.fromisoformat(w_dt[:10])
                lines.append(
                    PlanLineItem(
                        week_index=item.get("week_index", 0),
                        week_start=w_dt or self.current_week_start,
                        route=item.get("route", "domestic"),
                        lots=item.get("lots", 0),
                        quantity_t=item.get("quantity_t", item.get("tonnes", 0.0)),
                        unit_cost_p50=item.get("unit_cost_p50", item.get("unit_cost_inr_per_t", 0.0)),
                        total_cost_p50=item.get("total_cost_p50", item.get("total_cost_inr", 0.0)),
                    )
                )
            plan_obj = BuyPlanResult(
                plan_run_id=buy_plan_raw.get("plan_run_id", "plan-01"),
                created_at=datetime.datetime.utcnow(),
                solver_status=buy_plan_raw.get("solver_status", "optimal"),
                fallback=buy_plan_raw.get("fallback", False),
                horizon_weeks=buy_plan_raw.get("horizon_weeks", len(lines)),
                plan_lines=lines,
                projected_inventory_t=buy_plan_raw.get("projected_inventory_t", []),
                projected_shortage_t=buy_plan_raw.get("projected_shortage_t", []),
                total_shortage_t=buy_plan_raw.get("total_shortage_t", 0.0),
                cost_summary_inr=buy_plan_raw.get("cost_summary_inr", {"low": 0.0, "likely": 0.0, "high": 0.0}),
                binding_capacity_weeks=buy_plan_raw.get("binding_capacity_weeks", []),
                binding_minorder_weeks=buy_plan_raw.get("binding_minorder_weeks", []),
            )

        rev_dt = d.get("review_date")
        if isinstance(rev_dt, str):
            rev_dt = date.fromisoformat(rev_dt[:10])
        elif not rev_dt:
            rev_dt = self.current_week_start + timedelta(weeks=2)

        return RecommendationResponse(
            id=d.get("id", str(uuid.uuid4())),
            status=d.get("status", "pending"),
            created_at=datetime.datetime.utcnow(),
            headline=d.get("headline", ""),
            reasons=reasons,
            confidence=d.get("confidence", "medium"),
            review_date=rev_dt,
            buy_plan=plan_obj or self.build_buy_plan(),
            route_gap_inr_per_t=d.get("route_gap_inr_per_t"),
            data_origin="public",
        )

    def get_latest_prices(self) -> Dict[str, float]:
        dom = get_latest_weekly_price("DOM_SOY_BENCH")
        cbot = get_latest_weekly_price("INT_FUT_SOY")
        fx = get_latest_weekly_price("FX_USDINR")

        missing = [
            name for name, row in (
                ("DOM_SOY_BENCH", dom), ("INT_FUT_SOY", cbot), ("FX_USDINR", fx),
            ) if not row
        ]
        if missing:
            raise BlockedCalculation(
                "MISSING_PRICE_DATA",
                f"No real price data available for: {', '.join(missing)}",
                blockers=[f"no_real_data:{m}" for m in missing] + ["run_refresh"],
            )
        return {
            "domestic_inr_per_t": dom["value"],
            "cbot_usd_per_t": cbot["value"],
            "fx_rate": fx["value"],
        }

    def generate_or_get_forecast(self, force_refresh: bool = False) -> ForecastResult:
        if self.cached_forecast and not force_refresh:
            return self.cached_forecast

        rows = get_weekly_prices("DOM_SOY_BENCH")
        if len(rows) < 52:
            raise BlockedCalculation(
                "INSUFFICIENT_HISTORY",
                f"Not enough real domestic price history to forecast: {len(rows)} week(s) available, 52 required.",
                blockers=[
                    f"insufficient_history:DOM_SOY_BENCH:{len(rows)}_of_52_weeks",
                    "source_domestic_history_unavailable",
                    "see_docs_data-sources.md",
                ],
            )

        # Run real walk-forward forecast model
        df = pd.DataFrame(rows)
        df["week_start"] = pd.to_datetime(df["week_start"])
        df.set_index("week_start", inplace=True)
        log_prices = np.log(df["value"])

        metrics = walk_forward_metrics(log_prices, n_eval=min(52, len(rows) // 4))
        selected = select_model_per_horizon(metrics)
        fc_raw = produce_forecast(log_prices, selected)
        calibrated = calibrate_bands(fc_raw, log_prices)

        origin_dt = self.forecast_origin
        horizons: List[ForecastHorizonPoint] = []
        pts_to_save: List[Dict[str, Any]] = []

        sel_m = metrics.get(selected.get(1, "persistence"), {}).get(1, {})

        for h in range(1, 13):
            pt = calibrated.get(h, calibrated[1])
            w_date = origin_dt + timedelta(weeks=h - 1)
            p10 = round(math.exp(pt["p10"]), 2)
            p50 = round(math.exp(pt["p50"]), 2)
            p90 = round(math.exp(pt["p90"]), 2)
            model_name = pt.get("model_name", "persistence")

            horizons.append(
                ForecastHorizonPoint(
                    week_index=h - 1,
                    week_start=w_date,
                    p10=p10,
                    p50=p50,
                    p90=p90,
                    unit="INR/t",
                )
            )
            pts_to_save.append({
                "horizon_week": h,
                "target_week_start": w_date.isoformat(),
                "model_name": model_name,
                "p10": p10,
                "p50": p50,
                "p90": p90,
            })

        # Save to PostgreSQL forecast_runs & forecast_values
        run_id = save_forecast_run(
            target_series="DOM_SOY_BENCH",
            origin_week_start=origin_dt.isoformat(),
            points=pts_to_save,
            model_versions=selected,
        )

        res = ForecastResult(
            run_id=run_id,
            target="DOM_SOY_BENCH",
            origin_date=origin_dt,
            model_name=selected.get(1, "Ensemble"),
            metrics={
                k: round(v, 4) for k, v in {
                    "mape_p50_pct": (
                        sel_m["mape_p50"] * 100
                        if sel_m.get("mape_p50") is not None else None
                    ),
                    "pinball_loss": sel_m.get("pinball_log"),
                }.items() if v is not None
            },
            horizons=horizons,
            created_at=datetime.datetime.utcnow(),
        )
        self.cached_forecast = res
        return res

    def compute_landed_costs(self, overrides: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        fc = self.generate_or_get_forecast()
        latest = self.get_latest_prices()
        s = self.settings

        fx = latest["fx_rate"]
        cbot = latest["cbot_usd_per_t"]

        dom_shock = overrides.get("dom_price_shock_pct", 0.0) if overrides else 0.0
        int_shock = overrides.get("int_price_shock_pct", 0.0) if overrides else 0.0
        fx_shock = overrides.get("fx_shock_pct", 0.0) if overrides else 0.0
        mgr_view = overrides.get("manager_view_dom_pct", None) if overrides else None

        effective_fx = fx * (1.0 + fx_shock / 100.0)
        effective_cbot = cbot * (1.0 + int_shock / 100.0)

        results = []
        for h in fc.horizons:
            raw_p50 = h.p50 * (1.0 + dom_shock / 100.0)
            if mgr_view is not None:
                raw_p50 = raw_p50 * (1.0 + mgr_view / 100.0)

            dom_set = DomesticSettings(
                dom_market_fee_pct=s.mandi_tax_pct,
                dom_commission_pct=s.commission_pct,
                dom_transport_flat_inr_per_t=s.inland_freight_inr_per_t,
                dom_handling_inr_per_t=s.handling_unloading_inr_per_t,
                dom_quality_allowance_pct=s.shrinkage_pct,
            )
            dom_res = domestic_landed_cost(raw_p50, dom_set)

            imp_set = ImportSettings(
                imp_freight_usd_per_t=s.ocean_freight_usd_per_t,
                imp_insurance_pct=s.marine_insurance_pct,
                imp_landing_pct=s.landing_charge_pct,
                imp_duty_effective_pct=s.basic_customs_duty_pct + s.agriculture_infra_cess_pct,
                imp_port_clearing_inr_per_t=s.port_handling_inr_per_t,
                imp_inland_transport_inr_per_t=s.inland_transport_port_inr_per_t,
                finance_rate_annual=s.financing_rate_annual_pct,
                imp_prepay_days=max(0, s.imp_lead_time_days - s.dom_lead_time_days),
            )
            imp_res = import_landed_cost(effective_cbot, effective_fx, imp_set)

            diff = round(dom_res["total"] - imp_res["total"], 2)
            # Canonical route gap, computed ONCE here and reused everywhere:
            # import - domestic (positive => import is costlier).
            route_gap = round(imp_res["total"] - dom_res["total"], 2)
            rec_route = "import" if (s.import_enabled and diff > 800.0) else "domestic"

            results.append({
                "week_index": h.week_index,
                "week_start": h.week_start.isoformat(),
                "domestic": {
                    "total": round(dom_res["total"], 2),
                    "mandi_price": round(dom_res["base_price"], 2),
                    "mandi_fee": round(dom_res["market_fee"], 2),
                    "commission": round(dom_res["commission"], 2),
                    "transport": round(dom_res["transport"], 2),
                    "handling": round(dom_res["handling"], 2),
                    "shrinkage": round(dom_res["quality_allowance"], 2),
                },
                "imported": {
                    "total": round(imp_res["total"], 2),
                    "cif_inr": round(imp_res["cif_inr"], 2),
                    "duty": round(imp_res["duty"], 2),
                    "port": round(imp_res["port_clearing"], 2),
                    "inland": round(imp_res["inland_transport"], 2),
                    "financing": round(imp_res["financing"], 2),
                    "buffer": round(imp_res["risk_buffer"], 2),
                },
                "diff_inr_per_t": diff,
                "route_gap_inr_per_t": route_gap,
                "recommend_route": rec_route,
            })
        return results

    def build_buy_plan(self, overrides: Optional[Dict[str, Any]] = None) -> BuyPlanResult:
        s = self.settings
        fc = self.generate_or_get_forecast()
        lc = self.compute_landed_costs(overrides)
        T = len(lc)

        cost_d = [w["domestic"]["total"] for w in lc]
        cost_i = [w["imported"]["total"] for w in lc]

        cost_d_high = [round(c * 1.05, 2) for c in cost_d]
        cost_i_high = [round(c * 1.08, 2) for c in cost_i]

        demand = [s.weekly_consumption_t] * T
        if overrides and "consumption_change_pct" in overrides:
            factor = 1.0 + overrides["consumption_change_pct"] / 100.0
            demand = [round(d * factor, 2) for d in demand]

        lead_d = s.dom_lead_time_weeks
        lead_i = s.imp_lead_time_weeks
        if overrides:
            lead_d += int(overrides.get("domestic_delay_weeks", 0))
            lead_i += int(overrides.get("import_delay_weeks", 0))

        risk_w = overrides.get("risk_weight", s.risk_weight) if overrides else s.risk_weight

        opt_inp = OptimizerInputs(
            T=T,
            S0=s.starting_stock_t,
            demand=demand,
            SS=s.safety_stock_t,
            CAP=s.storage_capacity_t,
            lot_d=s.dom_lot_size_t,
            lead_d=lead_d,
            cost_d=cost_d,
            min_lots_d=1,
            import_enabled=s.import_enabled,
            lot_i=s.imp_lot_size_t,
            lead_i=lead_i,
            cost_i=cost_i,
            min_lots_i=1,
            pipeline=(list(s.pipeline_arrivals_t) + [0.0] * T)[:T],
            holding_cost_inr_per_t_week=s.holding_cost_inr_per_t_week,
            shortage_penalty_multiplier=s.shortage_penalty_multiplier,
            risk_weight=risk_w,
            cost_d_high=cost_d_high,
            cost_i_high=cost_i_high,
            terminal_enabled=True,
        )

        res = optimize(opt_inp)

        plan_items: List[PlanLineItem] = []
        schedule_for_db = []
        for line in res.plan_lines:
            w_date = self.forecast_origin + timedelta(weeks=line.week_index)
            plan_items.append(
                PlanLineItem(
                    week_index=line.week_index,
                    week_start=w_date,
                    route=line.route,
                    lots=line.lots,
                    quantity_t=line.tonnes,
                    unit_cost_p50=line.unit_cost_p50,
                    total_cost_p50=round(line.tonnes * line.unit_cost_p50, 2),
                )
            )
            schedule_for_db.append({
                "week_index": line.week_index,
                "order_week_start": w_date.isoformat(),
                "route": line.route,
                "lots": line.lots,
                "tonnes": line.tonnes,
                "unit_cost_inr_per_t": line.unit_cost_p50,
                "total_cost_inr": round(line.tonnes * line.unit_cost_p50, 2),
            })

        plan_id = str(uuid.uuid4())

        buy_plan = BuyPlanResult(
            plan_run_id=plan_id,
            created_at=datetime.datetime.utcnow(),
            solver_status=res.solver_status,
            fallback=res.fallback,
            horizon_weeks=T,
            plan_lines=plan_items,
            projected_inventory_t=[round(x, 1) for x in res.inv],
            projected_shortage_t=[round(x, 1) for x in res.short],
            total_shortage_t=round(res.shortage_total, 1),
            cost_summary_inr={
                "low": round(res.order_cost_low, 2),
                "likely": round(res.order_cost_p50, 2),
                "high": round(res.order_cost_high, 2),
            },
            binding_capacity_weeks=res.binding_capacity,
            binding_minorder_weeks=res.binding_minorder,
        )

        # Persist plan in DB
        save_plan_run(
            plan_data={
                "plan_id": plan_id,
                "schedule": schedule_for_db,
                "likely_total_cost_inr": res.order_cost_p50,
                "solver_status": res.solver_status,
                "fallback": res.fallback,
                "projected_inventory_t": res.inv,
                "projected_shortage_t": res.short,
                "binding_capacity_weeks": res.binding_capacity,
                "binding_minorder_weeks": res.binding_minorder,
                "cost_summary_inr": buy_plan.cost_summary_inr,
            },
            kind="base" if not overrides else "scenario",
            overrides=overrides,
            settings_version_id=s.version_id,
            domestic_forecast_run_id=fc.run_id,
        )

        return buy_plan

    def generate_recommendation(self) -> RecommendationResponse:
        plan = self.build_buy_plan()
        lc = self.compute_landed_costs()
        fc = self.generate_or_get_forecast()
        s = self.settings

        week0_tonnes_d = sum(p.quantity_t for p in plan.plan_lines if p.week_index == 0 and p.route == "domestic")
        week0_tonnes_i = sum(p.quantity_t for p in plan.plan_lines if p.week_index == 0 and p.route == "import")
        week0_total = week0_tonnes_d + week0_tonnes_i
        next4_demand = sum(s.weekly_consumption_t for _ in range(4))
        cover_pct_4w = (week0_total / next4_demand) if next4_demand > 0 else 0.0

        route_breakdown = "domestic"
        if week0_tonnes_d > 0 and week0_tonnes_i > 0:
            route_breakdown = f"{week0_tonnes_d:.0f}t domestic, {week0_tonnes_i:.0f}t import"
        elif week0_tonnes_i > 0:
            route_breakdown = "import"

        p0 = fc.horizons[0].p50
        p4 = fc.horizons[3].p50
        p8 = fc.horizons[7].p50

        dom_chg_4w = (p4 - p0) / p0 if p0 else 0.0
        dom_chg_8w = (p8 - p0) / p0 if p0 else 0.0
        dom_chg_4w_lo = (fc.horizons[3].p10 - p0) / p0 if p0 else 0.0
        dom_chg_4w_hi = (fc.horizons[3].p90 - p0) / p0 if p0 else 0.0
        band_rel_4w = ((fc.horizons[3].p90 - fc.horizons[3].p10) / p4) if p4 > 0 else 0.0

        # Read the canonical route gap from the single landed-cost function so the
        # dashboard and the cost-comparison screen always agree.
        route_gap = lc[0]["route_gap_inr_per_t"]
        abs_gap = abs(route_gap)
        cheaper_route = "domestic" if route_gap >= 0 else "import"

        current_stock = s.starting_stock_t
        daily_crush = s.weekly_consumption_t / 7.0
        cover_days = current_stock / daily_crush if daily_crush > 0 else 0.0

        shortage_weeks = [t for t, sh in enumerate(plan.projected_shortage_t) if sh > 0]
        max_short = max(plan.projected_shortage_t) if plan.projected_shortage_t else 0.0

        review_date_val = self.forecast_origin + timedelta(weeks=2)

        facts = ExplainFacts(
            dom_change_4w=dom_chg_4w,
            dom_change_4w_lo=dom_chg_4w_lo,
            dom_change_4w_hi=dom_chg_4w_hi,
            dom_change_8w=dom_chg_8w,
            band_rel_4w=band_rel_4w,
            route_gap=route_gap,
            cheaper_route=cheaper_route,
            abs_gap=abs_gap,
            cover_days=cover_days,
            lead_days_dom=s.dom_lead_time_days,
            lead_days_imp=s.imp_lead_time_days,
            shortage_weeks=shortage_weeks,
            shortage_max_t=max_short,
            week0_tonnes=week0_total,
            cover_pct_4w=cover_pct_4w,
            route_breakdown=route_breakdown,
            seasonal_drift=dom_chg_8w,
            seasonal_target_week="",
            binding_capacity_weeks=plan.binding_capacity_weeks,
            binding_minorder_weeks=plan.binding_minorder_weeks,
            import_enabled=s.import_enabled,
            review_date=review_date_val.isoformat(),
        )

        exp = explain(facts)
        rec_id = str(uuid.uuid4())

        reasons = [
            ReasonFact(id=r["id"], text=r["text"], fact_refs=r.get("fact_refs", []))
            for r in exp["reasons"]
        ]

        rec = RecommendationResponse(
            id=rec_id,
            status="pending",
            created_at=datetime.datetime.utcnow(),
            headline=exp["headline"],
            reasons=reasons,
            confidence=exp["confidence"],
            review_date=review_date_val,
            buy_plan=plan,
            route_gap_inr_per_t=route_gap,
            data_origin="public",
        )

        # Save recommendation to DB
        save_recommendation({
            "id": rec_id,
            "plan_run_id": plan.plan_run_id,
            "headline": exp["headline"],
            "reasons": [{"id": r.id, "text": r.text, "fact_refs": r.fact_refs} for r in reasons],
            "confidence": exp["confidence"],
            "review_date": review_date_val.isoformat(),
            "facts": facts.__dict__,
            "buy_plan": plan.model_dump(mode="json"),
            "data_origin_summary": {"real": True, "sample": False},
            "route_gap_inr_per_t": route_gap,
            "status": "pending",
        })

        self.latest_rec_id = rec_id
        return rec


# Global singleton instance bridging to PostgreSQL
store = SoyBuyDataStore()
