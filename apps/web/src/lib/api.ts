import {
  RecommendationData,
  ForecastData,
  LandedCostParity,
  DecisionRecord,
  SettingsData,
  UploadRecord,
  UploadValidationResult,
  BacktestSummary,
  SeriesStatus,
} from './types';

const BASE_URL = '/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || errJson.error?.message || errorDetail;
    } catch {
      // fallback
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Response normalisers.
//
// The FastAPI models and the TypeScript interfaces drifted apart in three
// places. Rather than duplicating mapping logic in every component, the
// translation happens once here, at the single API boundary. Each function
// below only renames/reshapes fields that the server really returns; nothing
// is synthesised.
// ---------------------------------------------------------------------------

function normalizeForecast(raw: any): ForecastData {
  // API returns `horizons`; the UI reads `points`.
  const points = raw?.points ?? raw?.horizons ?? [];
  return {
    ...raw,
    horizon_weeks: raw?.horizon_weeks ?? points.length,
    points,
  };
}

function normalizeRecommendation(raw: any): RecommendationData {
  // API has no `recommended_tonnes` field; derive it from the week-0 plan
  // lines so the dashboard, decision modal and report all read one number.
  const lines = raw?.buy_plan?.plan_lines ?? [];
  const week0 = lines
    .filter((l: any) => l.week_index === 0)
    .reduce((sum: number, l: any) => sum + (l.quantity_t ?? 0), 0);
  return {
    ...raw,
    recommended_tonnes:
      raw?.recommended_tonnes ?? (lines.length > 0 ? week0 : undefined),
  };
}

function normalizeParity(raw: any): LandedCostParity | null {
  // GET /landed-cost/compare returns an array of 12 week objects; the UI
  // renders the current (week 0) comparison.
  const week = Array.isArray(raw) ? raw[0] : raw;
  if (!week) return null;
  const d = week.domestic ?? {};
  const i = week.imported ?? week.import ?? {};
  const gap = week.route_gap_inr_per_t ?? week.parity_gap_inr_per_t;
  if (typeof gap !== 'number') return null;
  return {
    domestic: {
      spot_price_inr_per_t: d.mandi_price ?? 0,
      mandi_tax_inr_per_t: d.mandi_fee ?? 0,
      commission_inr_per_t: d.commission ?? 0,
      freight_inr_per_t: d.transport ?? 0,
      handling_inr_per_t: d.handling ?? 0,
      shrinkage_inr_per_t: d.shrinkage ?? 0,
      total_delivered_inr_per_t: d.total ?? 0,
    },
    import: {
      // Fields the per-week payload does not break out are left at 0 and are
      // not rendered anywhere.
      cbot_price_usd_per_t: i.cbot_usd_per_t ?? 0,
      fx_rate_inr_per_usd: i.fx_rate ?? 0,
      ocean_freight_usd_per_t: 0,
      cif_inr_per_t: i.cif_inr ?? 0,
      duty_inr_per_t: i.duty ?? 0,
      cess_inr_per_t: 0,
      port_handling_inr_per_t: i.port ?? 0,
      inland_transit_inr_per_t: i.inland ?? 0,
      finance_cost_inr_per_t: i.financing ?? 0,
      price_risk_buffer_inr_per_t: i.buffer ?? 0,
      total_delivered_inr_per_t: i.total ?? 0,
    },
    parity_gap_inr_per_t: gap,
    cheaper_route: gap >= 0 ? 'domestic' : 'import',
    effective_date: week.week_start ?? '',
  };
}

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return handleResponse<{ status: string; git_sha: string | null }>(res);
}

export async function fetchBootstrap() {
  const res = await fetch(`${BASE_URL}/bootstrap`);
  return handleResponse<any>(res);
}

export async function fetchRecommendation(): Promise<RecommendationData> {
  const res = await fetch(`${BASE_URL}/recommendations/latest`);
  return normalizeRecommendation(await handleResponse<any>(res));
}

export async function fetchForecast(target = 'DOM_SOY_BENCH'): Promise<ForecastData> {
  const res = await fetch(`${BASE_URL}/forecast/latest?target=${encodeURIComponent(target)}`);
  return normalizeForecast(await handleResponse<any>(res));
}

export async function triggerForecast(target = 'DOM_SOY_BENCH'): Promise<ForecastData> {
  const res = await fetch(`${BASE_URL}/forecast/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  return normalizeForecast(await handleResponse<any>(res));
}

export async function fetchLandedCostCompare(): Promise<LandedCostParity | null> {
  const res = await fetch(`${BASE_URL}/landed-cost/compare`);
  return normalizeParity(await handleResponse<any>(res));
}

export async function fetchDecisions(): Promise<DecisionRecord[]> {
  const res = await fetch(`${BASE_URL}/decisions`);
  return handleResponse<DecisionRecord[]>(res);
}

export async function submitDecision(payload: {
  recommendation_id?: string;
  action: 'approve' | 'modify' | 'reject';
  note?: string;
  decided_by?: string;
  modified_quantities_t?: Record<string, any>;
}): Promise<DecisionRecord> {
  const res = await fetch(`${BASE_URL}/decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DecisionRecord>(res);
}

export async function fetchDataStatus(): Promise<SeriesStatus[]> {
  const res = await fetch(`${BASE_URL}/data/status`);
  const data = await handleResponse<any>(res);
  return data.items || data || [];
}

export async function fetchSeasonality(): Promise<any> {
  const res = await fetch(`${BASE_URL}/analysis/seasonality`);
  return handleResponse<any>(res);
}

export async function fetchSettings(): Promise<SettingsData> {
  const res = await fetch(`${BASE_URL}/settings`);
  return handleResponse<SettingsData>(res);
}

export async function saveSettings(payload: SettingsData): Promise<SettingsData> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<SettingsData>(res);
}

export async function fetchSettingsVersions(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/settings/versions`);
  return handleResponse<any[]>(res);
}

export async function fetchBacktestSummary(): Promise<BacktestSummary> {
  const res = await fetch(`${BASE_URL}/backtest/summary`);
  return handleResponse<BacktestSummary>(res);
}

export async function runBacktest(): Promise<any> {
  const res = await fetch(`${BASE_URL}/backtests`, { method: 'POST' });
  return handleResponse<any>(res);
}

export async function runScenario(scenarioPayload: {
  name?: string;
  domestic_spot_shock_pct?: number;
  cbot_shock_pct?: number;
  usd_inr_shock_pct?: number;
  consumption_shock_pct?: number;
  import_lead_time_weeks?: number;
  ocean_freight_usd_per_t?: number;
  customs_duty_pct?: number;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenarioPayload),
  });
  return handleResponse<any>(res);
}

export async function fetchSavedScenarios(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/scenarios`);
  const data = await handleResponse<any>(res);
  return data.items || [];
}

export async function saveScenario(payload: { name: string; description?: string; overrides: any }): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<any>(res);
}

export async function deleteScenario(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios/${id}`, { method: 'DELETE' });
  return handleResponse<any>(res);
}

export async function fetchUploads(): Promise<UploadRecord[]> {
  const res = await fetch(`${BASE_URL}/uploads`);
  const data = await handleResponse<{ items: UploadRecord[]; total: number }>(res);
  return data.items || [];
}

export async function validateUploadCSV(file: File, kind: string): Promise<UploadValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);

  const res = await fetch(`${BASE_URL}/uploads/validate`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<UploadValidationResult>(res);
}

export async function uploadCSV(file: File, kind: string, mode = 'partial'): Promise<UploadRecord> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);
  formData.append('mode', mode);

  const res = await fetch(`${BASE_URL}/uploads`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<any>(res);
}

export async function addManualObservation(payload: {
  seriesId: string;
  obs_date: string;
  value: number;
  unit?: string;
  location_name?: string;
  note?: string;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/series/${payload.seriesId}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      obs_date: payload.obs_date,
      value: payload.value,
      unit: payload.unit || 'INR/t',
      location_name: payload.location_name,
      note: payload.note,
    }),
  });
  return handleResponse<any>(res);
}

export async function fetchCurrentUser(userId?: string): Promise<any> {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`${BASE_URL}/me${query}`);
  return handleResponse<any>(res);
}

export async function syncUserProfile(payload: {
  user_id: string;
  email: string;
  full_name?: string;
  role?: string;
  organization?: string;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<any>(res);
}

export async function fetchAuditLog(limit = 50): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/audit-log?limit=${limit}`);
  const data = await handleResponse<any>(res);
  return data.items || [];
}
