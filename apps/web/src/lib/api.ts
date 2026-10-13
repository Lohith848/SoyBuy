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
  return handleResponse<RecommendationData>(res);
}

export async function fetchForecast(target = 'DOM_SOY_BENCH'): Promise<ForecastData> {
  const res = await fetch(`${BASE_URL}/forecast/latest?target=${encodeURIComponent(target)}`);
  return handleResponse<ForecastData>(res);
}

export async function triggerForecast(target = 'DOM_SOY_BENCH'): Promise<ForecastData> {
  const res = await fetch(`${BASE_URL}/forecast/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  return handleResponse<ForecastData>(res);
}

export async function fetchLandedCostCompare(): Promise<LandedCostParity> {
  const res = await fetch(`${BASE_URL}/landed-cost/compare`);
  return handleResponse<LandedCostParity>(res);
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
