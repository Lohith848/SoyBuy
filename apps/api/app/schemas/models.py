"""
Pydantic v2 schemas for SoyBuy API. Spec Part E & Part C.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Settings
# ============================================================================

class SettingsModel(BaseModel):
    version_id: Optional[str] = "v1-default"
    effective_from: date = Field(default_factory=date.today)
    notes: Optional[str] = "Initial operational baseline (SAMPLE/DEFAULT)"

    # Operating constraints
    storage_capacity_t: float = Field(default=2500.0, description="Max storage in tonnes")
    safety_stock_t: float = Field(default=400.0, description="Minimum safety stock in tonnes")
    weekly_consumption_t: float = Field(default=350.0, description="Nominal weekly crush in tonnes")

    # Current state — explicit client inputs, never silently assumed in code.
    starting_stock_t: float = Field(default=0.0, description="Opening on-hand stock for the plan horizon (tonnes)")
    pipeline_arrivals_t: List[float] = Field(default_factory=list, description="Committed pipeline arrivals per week (tonnes)")

    # Domestic settings
    dom_lot_size_t: float = Field(default=25.0, description="Mandi lot size in tonnes (default 25t)")
    dom_lead_time_days: int = Field(default=3, description="Domestic lead time in days")
    dom_lead_time_weeks: int = Field(default=1, description="Domestic lead time in weeks")
    mandi_tax_pct: float = Field(default=0.015, description="Mandi cess / fee fraction (1.5%)")
    commission_pct: float = Field(default=0.010, description="Commission fraction (1.0%)")
    inland_freight_inr_per_t: float = Field(default=1800.0, description="Transport INR/t")
    handling_unloading_inr_per_t: float = Field(default=250.0, description="Handling INR/t")
    shrinkage_pct: float = Field(default=0.005, description="Transit shrinkage fraction (0.5%)")

    # Import settings
    import_enabled: bool = Field(default=True, description="Whether import route is open")
    imp_lot_size_t: float = Field(default=100.0, description="Container/breakbulk lot size in tonnes")
    imp_lead_time_days: int = Field(default=35, description="Import lead time in days")
    imp_lead_time_weeks: int = Field(default=5, description="Import lead time in weeks")
    ocean_freight_usd_per_t: float = Field(default=45.0, description="Ocean freight USD/t")
    marine_insurance_pct: float = Field(default=0.005, description="Marine insurance fraction (0.5%)")
    landing_charge_pct: float = Field(default=0.010, description="Landing charge fraction (1.0%)")
    basic_customs_duty_pct: float = Field(default=0.0, description="Customs duty fraction (0.0% current concessional)")
    agriculture_infra_cess_pct: float = Field(default=0.050, description="AIDC cess fraction (5.0%)")
    social_welfare_surcharge_pct: float = Field(default=0.100, description="SWS fraction on duty (10.0%)")
    port_handling_inr_per_t: float = Field(default=1200.0, description="Port & clearance INR/t")
    inland_transport_port_inr_per_t: float = Field(default=2200.0, description="Inland transit from port INR/t")
    financing_rate_annual_pct: float = Field(default=0.100, description="Cost of capital (10.0% p.a.)")
    price_risk_buffer_inr_per_t: float = Field(default=500.0, description="Import FX/lead buffer INR/t")

    # Optimizer knobs
    holding_cost_inr_per_t_week: float = Field(default=50.0, description="Weekly inventory carry cost INR/t")
    shortage_penalty_multiplier: float = Field(default=5.0, description="Penalty relative to max cost")
    risk_weight: float = Field(default=0.0, description="Weight on high cost path (0=likely, 1=high)")

    # General enterprise settings
    company_name: str = Field(default="ABT-CPD Agri-Business", description="Enterprise company name")
    currency: str = Field(default="INR", description="Base accounting currency")
    timezone: str = Field(default="Asia/Kolkata", description="Operating timezone")
    language: str = Field(default="en-IN", description="Display language")

    # Forecast configuration
    forecast_horizon_weeks: int = Field(default=12, description="Prediction horizon in weeks")
    confidence_interval: str = Field(default="80% (p10-p90)", description="Quantile confidence band")
    model_selection: str = Field(default="qgbm", description="Forecasting model (qgbm, ets, seasonal_naive, persistence)")

    # Simulation knobs
    timestep: str = Field(default="weekly", description="Simulation timestep")
    simulation_duration_weeks: int = Field(default=12, description="Simulation duration in weeks")
    update_frequency: str = Field(default="Every Monday 06:00 IST", description="Auto recalculation cadence")

    # Data preferences
    upload_preference: str = Field(default="strict", description="Validation mode")
    overwrite_options: str = Field(default="version_on_conflict", description="Conflict resolution")
    duplicate_policy: str = Field(default="reject_duplicates", description="Duplicate row policy")

    # System & governance
    cache_enabled: bool = Field(default=True, description="Enable database query caching")
    backup_policy: str = Field(default="continuous_wal", description="Database backup policy")

    model_config = {"extra": "allow"}


# ============================================================================
# Series & Observations
# ============================================================================

class ObservationPoint(BaseModel):
    series_id: str
    obs_date: date
    value: float
    unit: str
    source_name: Optional[str] = None
    data_origin: str = "public"


class WeeklyPricePoint(BaseModel):
    series_id: str
    week_start: date
    price: float
    unit: str
    change_pct: Optional[float] = None


# ============================================================================
# Forecast
# ============================================================================

class ForecastHorizonPoint(BaseModel):
    week_index: int
    week_start: date
    p10: float
    p50: float
    p90: float
    unit: str = "INR/t"


class ForecastResult(BaseModel):
    run_id: str
    target: str = "DOM_SOY_BENCH"
    origin_date: date
    model_name: str
    metrics: dict[str, float] = Field(default_factory=dict)
    horizons: List[ForecastHorizonPoint] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Landed Cost
# ============================================================================

class LandedCostComponent(BaseModel):
    name: str
    amount_inr: float
    pct_of_total: float


class LandedCostBreakdown(BaseModel):
    week_index: int
    week_start: date
    route: str  # 'domestic' or 'import'
    base_price_unit: float
    base_price_unit_name: str
    fx_rate: Optional[float] = None
    total_landed_inr_per_t: float
    components: List[LandedCostComponent]


class LandedCostComparisonWeek(BaseModel):
    week_index: int
    week_start: date
    domestic: LandedCostBreakdown
    imported: LandedCostBreakdown
    diff_inr_per_t: float  # domestic - imported (positive = import is cheaper)
    recommend_route: str


# ============================================================================
# Buy Plan
# ============================================================================

class PlanLineItem(BaseModel):
    week_index: int
    week_start: date
    route: str
    lots: int
    quantity_t: float
    unit_cost_p50: float
    total_cost_p50: float


class BuyPlanResult(BaseModel):
    plan_run_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    solver_status: str
    fallback: bool
    horizon_weeks: int
    plan_lines: List[PlanLineItem]
    projected_inventory_t: List[float]
    projected_shortage_t: List[float]
    total_shortage_t: float
    cost_summary_inr: dict[str, float]  # low, likely, high
    binding_capacity_weeks: List[int]
    binding_minorder_weeks: List[int]


# ============================================================================
# Recommendation & Decision
# ============================================================================

class ReasonFact(BaseModel):
    id: str
    text: str
    fact_refs: List[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    id: str
    status: str  # pending, approved, modified, rejected, superseded
    created_at: datetime = Field(default_factory=datetime.utcnow)
    headline: str
    reasons: List[ReasonFact]
    confidence: str  # high, medium, low
    review_date: date
    buy_plan: BuyPlanResult
    # Canonical route gap: import - domestic (positive => import costlier).
    # Same value the /landed-cost/compare screen shows (cross-screen consistency).
    route_gap_inr_per_t: Optional[float] = None
    data_origin: str = "public"


class DecisionRequest(BaseModel):
    action: str = Field(..., description="'approve', 'modify', or 'reject'")
    decided_by: str = "Procurement Manager"
    note: Optional[str] = None
    modified_quantities_t: Optional[dict[int, float]] = None


class DecisionRecord(BaseModel):
    id: str
    recommendation_id: str
    action: str
    decided_by: str
    decided_at: datetime = Field(default_factory=datetime.utcnow)
    note: Optional[str] = None
    modified_quantities_t: Optional[dict[int, float]] = None


# ============================================================================
# Scenarios
# ============================================================================

class ScenarioRunRequest(BaseModel):
    dom_price_shock_pct: float = 0.0
    int_price_shock_pct: float = 0.0
    fx_shock_pct: float = 0.0
    import_delay_weeks: int = 0
    domestic_delay_weeks: int = 0
    consumption_change_pct: float = 0.0
    risk_weight: float = 0.0
    manager_view_dom_pct: Optional[float] = None


class ScenarioRunResponse(BaseModel):
    base_plan: BuyPlanResult
    scenario_plan: BuyPlanResult
    delta_likely_cost_inr: float
    delta_week0_tonnes: float
    delta_shortage_t: float
    overrides_applied: List[str]
    solver_time_ms: float = 0.0


# ============================================================================
# Backtest
# ============================================================================

class StrategyMetrics(BaseModel):
    strategy_name: str
    average_cost_inr_per_t: float
    total_spend_inr: float
    total_procured_t: float
    stockout_weeks: int
    days_below_safety_stock: int
    savings_vs_reorder_pct: float


class BacktestSummary(BaseModel):
    run_id: str
    test_period: str
    strategies: List[StrategyMetrics]
    forecast_mape_pct: float
    band_coverage_80_pct: float
    conclusion: str
