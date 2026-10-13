-- Progress reporting for long runs
alter table forecast_runs add column if not exists progress jsonb;
alter table backtest_runs add column if not exists progress jsonb;

-- Source tag per settings field: client_confirmed | team_assumption | unverified_external
alter table settings_versions add column if not exists field_sources jsonb not null default '{}'::jsonb;

-- Refresh chain
create table if not exists refresh_runs (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references app_user_profile(user_id),
  status       run_status not null default 'queued',
  steps        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text
);

-- Counterfactuals computed after each recommendation
create table if not exists recommendation_counterfactuals (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  label             text not null,
  override          jsonb not null,
  status            text not null default 'queued' check (status in ('queued','ready','failed')),
  result            jsonb,
  computed_at       timestamptz,
  unique (recommendation_id, label)
);
create index if not exists counterfactuals_rec_idx on recommendation_counterfactuals (recommendation_id);

-- Live track record: stored forecasts compared with prices that later happened
create or replace view forecast_outcomes with (security_invoker = true) as
select fv.run_id,
       fr.target_series,
       fr.origin_week_start,
       fv.horizon_week,
       fv.target_week_start,
       fv.model_name,
       fv.p10, fv.p50, fv.p90,
       wp.value as actual,
       (wp.value between fv.p10 and fv.p90) as inside_band,
       abs(wp.value - fv.p50) / nullif(wp.value, 0) as abs_pct_error
from forecast_values fv
join forecast_runs fr on fr.id = fv.run_id and fr.status = 'succeeded'
join weekly_prices wp on wp.series_id = fr.target_series
                     and wp.week_start = fv.target_week_start
                     and wp.value is not null;

-- Access: same pattern as migration 0002
alter table refresh_runs enable row level security;
alter table recommendation_counterfactuals enable row level security;
create policy api_full_access on refresh_runs
  for all to soybuy_api using (true) with check (true);
create policy api_full_access on recommendation_counterfactuals
  for all to soybuy_api using (true) with check (true);
grant select, insert, update, delete on refresh_runs, recommendation_counterfactuals to soybuy_api;
grant select on forecast_outcomes to soybuy_api;
revoke all on refresh_runs, recommendation_counterfactuals, forecast_outcomes from anon, authenticated;
