export type FreshnessState = 'not_configured' | 'fresh' | 'warn' | 'fail';

export interface SeriesStatus {
  series_id: string;
  description: string;
  raw_unit: string;
  canonical_unit: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  latest_observation_date: string | null;
  freshness: FreshnessState;
  data_origin: 'public' | 'client' | 'sample' | 'manual' | null;
  observation_count?: number;
}

export interface PlanLine {
  week_index: number;
  week_start: string;
  route: 'domestic' | 'import';
  lots: number;
  quantity_t: number;
  unit_cost_p50: number;
  total_cost_p50: number;
}

export interface RecommendationData {
  id: string;
  status: 'pending' | 'approved' | 'modified' | 'rejected' | 'superseded';
  created_at: string;
  headline: string;
  reasons: Array<{ id: string; text: string; fact_refs?: string }>;
  confidence: 'low' | 'medium' | 'high';
  review_date: string;
  recommended_tonnes?: number;
  route_gap_inr_per_t: number;
  data_origin: string;
  buy_plan?: {
    plan_run_id: string;
    created_at: string;
    solver_status: string;
    fallback: boolean;
    horizon_weeks: number;
    plan_lines: PlanLine[];
    projected_inventory_t: number[];
    projected_shortage_t: number[];
    total_shortage_t: number;
    cost_summary_inr: {
      low: number;
      likely: number;
      high: number;
    };
  };
}

export interface ForecastHorizonPoint {
  week_index: number;
  week_start: string;
  p10: number;
  p50: number;
  p90: number;
  unit: string;
}

export interface ForecastData {
  run_id: string;
  target: string;
  origin_date: string;
  model_name: string;
  horizon_weeks: number;
  points: ForecastHorizonPoint[];
  metrics?: Record<string, number>;
  created_at: string;
}

export interface LandedCostParity {
  domestic: {
    spot_price_inr_per_t: number;
    mandi_tax_inr_per_t: number;
    commission_inr_per_t: number;
    freight_inr_per_t: number;
    handling_inr_per_t: number;
    shrinkage_inr_per_t: number;
    total_delivered_inr_per_t: number;
  };
  import: {
    cbot_price_usd_per_t: number;
    fx_rate_inr_per_usd: number;
    ocean_freight_usd_per_t: number;
    cif_inr_per_t: number;
    duty_inr_per_t: number;
    cess_inr_per_t: number;
    port_handling_inr_per_t: number;
    inland_transit_inr_per_t: number;
    finance_cost_inr_per_t: number;
    price_risk_buffer_inr_per_t: number;
    total_delivered_inr_per_t: number;
  };
  parity_gap_inr_per_t: number;
  cheaper_route: 'domestic' | 'import';
  effective_date: string;
}

export interface DecisionRecord {
  id: string;
  recommendation_id: string;
  action: 'approve' | 'modify' | 'reject';
  decided_by?: string | null;
  decided_at: string;
  note?: string | null;
  modified_quantities_t?: Record<string, any> | null;
}

export interface SettingsData {
  id?: string;
  version_id?: string;
  effective_from?: string;
  notes?: string;

  // Operating constraints
  storage_capacity_t: number;
  safety_stock_t: number;
  weekly_consumption_t: number;
  starting_stock_t?: number;

  // Domestic parameters
  dom_lot_size_t: number;
  dom_lead_time_days: number;
  dom_lead_time_weeks?: number;
  mandi_tax_pct?: number;
  commission_pct?: number;
  inland_freight_inr_per_t?: number;
  handling_unloading_inr_per_t?: number;
  shrinkage_pct?: number;

  // Import parameters
  import_enabled: boolean;
  imp_lot_size_t: number;
  imp_lead_time_days: number;
  imp_lead_time_weeks?: number;
  ocean_freight_usd_per_t?: number;
  marine_insurance_pct?: number;
  landing_charge_pct?: number;
  basic_customs_duty_pct?: number;
  agriculture_infra_cess_pct?: number;
  social_welfare_surcharge_pct?: number;
  port_handling_inr_per_t?: number;
  inland_transport_port_inr_per_t?: number;
  financing_rate_annual_pct?: number;
  price_risk_buffer_inr_per_t?: number;

  // Enterprise & knobs
  company_name?: string;
  currency?: string;
  timezone?: string;
  language?: string;
  forecast_horizon_weeks?: number;
  confidence_interval?: string;
  model_selection?: string;
  timestep?: string;
  simulation_duration_weeks?: number;
  update_frequency?: string;
  upload_preference?: string;
  overwrite_options?: string;
  duplicate_policy?: string;
  cache_enabled?: boolean;
  backup_policy?: string;
}

export interface UploadRecord {
  upload_id: string;
  kind: string;
  filename: string;
  status: string;
  rows_total: number;
  rows_loaded: number;
  rows_rejected: number;
  uploaded_at: string | null;
}

export interface UploadValidationResult {
  kind: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  columns: string[];
  preview_rows: Record<string, any>[];
  errors: Array<{ line: number; error: string }>;
}

export interface BacktestStrategy {
  strategy: string;
  strategy_name: string;
  average_cost_inr_per_t: number;
  total_spend_inr: number;
  total_procured_t: number;
  stockout_weeks: number;
  savings_vs_reorder_pct: number;
  savings_ci_low_pct?: number | null;
  savings_ci_high_pct?: number | null;
  n_windows?: number;
}

export interface BacktestSummary {
  run_id: string;
  test_period: string;
  demand_source: string;
  finished_at: string;
  strategies: BacktestStrategy[];
  conclusion: string;
}

export interface ScenarioRunResult {
  plan_run_id: string;
  name?: string;
  status: string;
  total_spend_inr: number;
  total_tonnes: number;
  avg_cost_inr_per_t: number;
  shortage_tonnes: number;
  plan_lines: PlanLine[];
  delta_vs_base_inr?: number;
  delta_vs_base_pct?: number;
}
