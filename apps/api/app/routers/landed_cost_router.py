"""
Landed-cost comparison API router.  Spec E.2 POST /landed-cost/compare.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.landed_cost import (
    domestic_landed_cost, import_landed_cost, projected_fx,
    DomesticSettings, ImportSettings,
)

router = APIRouter()


class LandedCostCompareRequest(BaseModel):
    # Domestic price path (p10, p50, p90 per horizon week 1-12)
    dom_p10: list[float] = Field(..., min_length=1, max_length=12)
    dom_p50: list[float] = Field(..., min_length=1, max_length=12)
    dom_p90: list[float] = Field(..., min_length=1, max_length=12)
    # International price path USD/t (p10, p50, p90)
    int_p10: list[float] = Field(..., min_length=1, max_length=12)
    int_p50: list[float] = Field(..., min_length=1, max_length=12)
    int_p90: list[float] = Field(..., min_length=1, max_length=12)
    # FX settings
    fx_spot_inr_per_usd: float
    fx_drift_annual: float = 0.0
    fx_shock: float = 0.0
    # Settings
    settings: dict
    # Overrides (scenario)
    dom_price_shock_pct: float = 0.0
    int_price_shock_pct: float = 0.0


class ComponentsResponse(BaseModel):
    total_inr_per_t: float
    components: dict


class WeekComparison(BaseModel):
    horizon_week: int
    domestic_low: ComponentsResponse
    domestic_likely: ComponentsResponse
    domestic_high: ComponentsResponse
    import_low: Optional[ComponentsResponse] = None
    import_likely: Optional[ComponentsResponse] = None
    import_high: Optional[ComponentsResponse] = None
    gap_likely_inr_per_t: Optional[float] = None   # import - domestic (positive = import costlier)
    cheaper_route: str = "domestic"


def _build_dom_settings(s: dict) -> DomesticSettings:
    return DomesticSettings(
        dom_market_fee_pct=s.get("dom_market_fee_pct", 0.0),
        dom_commission_pct=s.get("dom_commission_pct", 0.0),
        dom_transport_flat_inr_per_t=s.get("dom_transport_flat_inr_per_t"),
        dom_transport_inr_per_t_km=s.get("dom_transport_inr_per_t_km"),
        dom_distance_km=s.get("dom_distance_km"),
        dom_handling_inr_per_t=s.get("dom_handling_inr_per_t", 0.0),
        dom_quality_allowance_pct=s.get("dom_quality_allowance_pct", 0.0),
        dom_other_taxes_pct=s.get("dom_other_taxes_pct", 0.0),
        finance_rate_annual=s.get("finance_rate_annual", 0.0),
        dom_prepay_days=s.get("dom_prepay_days", 0),
    )


def _build_imp_settings(s: dict) -> ImportSettings:
    return ImportSettings(
        fob_premium_usd_per_t=s.get("fob_premium_usd_per_t", 0.0),
        imp_freight_usd_per_t=s.get("imp_freight_usd_per_t", 0.0),
        imp_insurance_pct=s.get("imp_insurance_pct", 0.0),
        imp_landing_pct=s.get("imp_landing_pct", 0.0),
        imp_duty_effective_pct=s.get("imp_duty_effective_pct", 0.0),
        imp_port_clearing_inr_per_t=s.get("imp_port_clearing_inr_per_t", 0.0),
        imp_inland_transport_inr_per_t=s.get("imp_inland_transport_inr_per_t", 0.0),
        imp_handling_inr_per_t=s.get("imp_handling_inr_per_t", 0.0),
        imp_quality_allowance_pct=s.get("imp_quality_allowance_pct", 0.0),
        imp_risk_buffer_pct=s.get("imp_risk_buffer_pct", 0.0),
        finance_rate_annual=s.get("finance_rate_annual", 0.0),
        imp_prepay_days=s.get("imp_prepay_days", 0),
    )


@router.post("/landed-cost/compare", response_model=list[WeekComparison])
async def compare_landed_cost(req: LandedCostCompareRequest):
    """
    Returns domestic vs import landed cost for each of the 12 order weeks,
    with low/likely/high price paths and component breakdowns.  Spec FR-LC-05.
    """
    dom_s = _build_dom_settings(req.settings)
    import_enabled = req.settings.get("import_enabled", False)
    imp_s = _build_imp_settings(req.settings) if import_enabled else None

    n = len(req.dom_p50)
    result = []

    for t in range(n):
        h = t + 1
        fx = projected_fx(req.fx_spot_inr_per_usd, req.fx_drift_annual, h, req.fx_shock)

        # Apply shocks
        dom_shock = 1.0 + req.dom_price_shock_pct / 100.0
        int_shock = 1.0 + req.int_price_shock_pct / 100.0

        dom_low = domestic_landed_cost(req.dom_p10[t] * dom_shock, dom_s)
        dom_likely = domestic_landed_cost(req.dom_p50[t] * dom_shock, dom_s)
        dom_high = domestic_landed_cost(req.dom_p90[t] * dom_shock, dom_s)

        week = WeekComparison(
            horizon_week=h,
            domestic_low=ComponentsResponse(total_inr_per_t=dom_low["total"], components=dom_low),
            domestic_likely=ComponentsResponse(total_inr_per_t=dom_likely["total"], components=dom_likely),
            domestic_high=ComponentsResponse(total_inr_per_t=dom_high["total"], components=dom_high),
        )

        if import_enabled and imp_s:
            imp_low = import_landed_cost(req.int_p10[t] * int_shock, fx, imp_s)
            imp_likely = import_landed_cost(req.int_p50[t] * int_shock, fx, imp_s)
            imp_high = import_landed_cost(req.int_p90[t] * int_shock, fx, imp_s)

            gap = imp_likely["total"] - dom_likely["total"]
            week.import_low = ComponentsResponse(total_inr_per_t=imp_low["total"], components=imp_low)
            week.import_likely = ComponentsResponse(total_inr_per_t=imp_likely["total"], components=imp_likely)
            week.import_high = ComponentsResponse(total_inr_per_t=imp_high["total"], components=imp_high)
            week.gap_likely_inr_per_t = gap
            week.cheaper_route = "domestic" if gap >= 0 else "import"

        result.append(week)

    return result


@router.get("/landed-cost/compare")
async def get_active_landed_cost_compare():
    """
    Returns active 12-week landed cost comparison based on current system settings and forecast.
    """
    from app.services.data_store import store
    return store.compute_landed_costs()
