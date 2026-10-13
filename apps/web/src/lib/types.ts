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
}

export interface RequiredSetting {
  field: string;
  unit: string;
  label: string;
}

export interface BootstrapState {
  data_status: SeriesStatus[];
  data_origin_summary: { sample: boolean; manual_override: boolean };
  settings: {
    active_version_id: string | null;
    import_enabled: boolean;
    missing_required_fields: RequiredSetting[];
  };
  recommendation: any | null;
  latest_forecast_run_ids: string[];
  ready_for_plan: boolean;
  prototype_notice: string;
}
