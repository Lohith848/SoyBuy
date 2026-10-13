-- ===== Enumerated types =====
create type app_role          as enum ('admin','manager','buyer','viewer');
create type route_type        as enum ('domestic','import');
create type data_origin_type  as enum ('public','client','sample','manual');
create type run_status        as enum ('queued','running','succeeded','failed','cancelled');
create type upload_kind       as enum ('purchases','stock','consumption','lead_times','pipeline');
create type upload_status     as enum ('validating','rejected','loaded','partially_loaded');
create type quality_status    as enum ('pass','warn','fail');
create type rec_status        as enum ('pending','approved','modified','rejected','superseded');
create type decision_action   as enum ('approve','modify','reject');
create type plan_kind         as enum ('base','scenario');
create type solver_status_type as enum ('optimal','feasible_time_limit','fallback');

-- ===== Users =====
create table app_user_profile (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       app_role not null default 'viewer',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== Series catalog and market data =====
create table series_catalog (
  series_id            text primary key,
  description          text not null,
  raw_unit             text not null,
  canonical_unit       text not null,
  frequency            text not null check (frequency in ('daily','weekly','monthly')),
  source_name          text not null,
  publication_lag_days integer not null default 0 check (publication_lag_days >= 0),
  is_active            boolean not null default true,
  verified_on          date,
  notes                text
);

create table mandi_selection (
  id         uuid primary key default gen_random_uuid(),
  state      text not null,
  district   text,
  market     text not null,
  is_active  boolean not null default true,
  created_by uuid references app_user_profile(user_id),
  created_at timestamptz not null default now(),
  unique (state, market)
);

create table ingest_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        run_status not null default 'running',
  rows_inserted integer not null default 0,
  rows_updated  integer not null default 0,
  error         text
);

create table price_observations (
  id            bigint generated always as identity primary key,
  series_id     text not null references series_catalog(series_id),
  dimension_key text not null default '',   -- for DOM_SOY_MANDI: lower(state || '|' || market)
  obs_date      date not null,
  revision      integer not null default 1 check (revision >= 1),
  value         numeric(18,6) not null,     -- canonical unit
  raw_value     numeric(18,6),
  raw_unit      text,
  published_at  timestamptz not null,
  data_origin   data_origin_type not null default 'public',
  is_excluded   boolean not null default false,
  excluded_reason text,
  note          text,
  ingest_run_id uuid references ingest_runs(id),
  created_by    uuid references app_user_profile(user_id),
  created_at    timestamptz not null default now(),
  unique (series_id, dimension_key, obs_date, revision)
);
create index price_obs_series_date_idx on price_observations (series_id, obs_date);

-- Latest revision per (series, dimension, date); excluded values are hidden after choosing the latest revision.
create view price_latest with (security_invoker = true) as
select * from (
  select distinct on (series_id, dimension_key, obs_date) *
  from price_observations
  order by series_id, dimension_key, obs_date, revision desc
) x
where not x.is_excluded;

create table weekly_prices (
  series_id    text not null references series_catalog(series_id),
  week_start   date not null check (extract(isodow from week_start) = 1),
  value        numeric(18,6),               -- canonical unit; null when missing
  n_obs        integer not null default 0,
  is_imputed   boolean not null default false,
  quality_flag text check (quality_flag in ('jump_suspect','outlier_suspect','missing')),
  known_at     timestamptz not null,
  computed_at  timestamptz not null default now(),
  primary key (series_id, week_start)
);

-- ===== Uploads and client operational data =====
create table upload_files (
  id            uuid primary key default gen_random_uuid(),
  kind          upload_kind not null,
  filename      text not null,
  storage_path  text not null,
  sha256        text not null,
  mode          text not null check (mode in ('strict','partial')),
  quantity_unit text not null default 't' check (quantity_unit in ('t','kg','quintal')),
  price_unit    text not null default 'inr_per_t'
                check (price_unit in ('inr_per_t','inr_per_quintal','inr_per_kg')),
  status        upload_status not null default 'validating',
  rows_total    integer,
  rows_loaded   integer,
  rows_rejected integer,
  error_report  jsonb,
  data_origin   data_origin_type not null default 'client',
  uploaded_by   uuid references app_user_profile(user_id),
  uploaded_at   timestamptz not null default now()
);

create table lead_time_profiles (
  id             uuid primary key default gen_random_uuid(),
  route          route_type not null,
  supplier       text not null default '',
  origin         text,
  lead_days      integer not null check (lead_days between 0 and 365),
  effective_from date not null,
  data_origin    data_origin_type not null default 'client',
  upload_file_id uuid references upload_files(id),
  created_by     uuid references app_user_profile(user_id),
  created_at     timestamptz not null default now(),
  unique (route, supplier, effective_from)
);

create table purchases (
  id                    uuid primary key default gen_random_uuid(),
  purchase_date         date not null,
  route                 route_type not null,
  supplier              text not null default '',
  quantity_t            numeric(14,3) not null check (quantity_t > 0),
  price_inr_per_t       numeric(14,2) not null check (price_inr_per_t > 0),
  price_basis           text not null default 'other'
                        check (price_basis in ('mandi','delivered_plant','cif_port','other')),
  delivery_date         date,
  landed_cost_inr_per_t numeric(14,2),
  notes                 text,
  data_origin           data_origin_type not null default 'client',
  upload_file_id        uuid references upload_files(id),
  created_at            timestamptz not null default now(),
  check (delivery_date is null or delivery_date >= purchase_date),
  unique (purchase_date, route, supplier, quantity_t, price_inr_per_t)
);
create index purchases_date_idx on purchases (purchase_date);

create table stock_snapshots (
  snapshot_date  date primary key,
  quantity_t     numeric(14,3) not null check (quantity_t >= 0),
  data_origin    data_origin_type not null default 'client',
  upload_file_id uuid references upload_files(id),
  updated_at     timestamptz not null default now()
);

create table consumption_records (
  id             uuid primary key default gen_random_uuid(),
  period_start   date not null,
  period_end     date not null,
  quantity_t     numeric(14,3) not null check (quantity_t >= 0),
  data_origin    data_origin_type not null default 'client',
  upload_file_id uuid references upload_files(id),
  created_at     timestamptz not null default now(),
  check (period_end >= period_start),
  constraint consumption_no_overlap
    exclude using gist (daterange(period_start, period_end, '[]') with &&)
);

create table pipeline_orders (
  id                    uuid primary key default gen_random_uuid(),
  route                 route_type not null,
  supplier              text not null default '',
  order_date            date not null,
  expected_arrival_date date not null,
  quantity_t            numeric(14,3) not null check (quantity_t > 0),
  status                text not null default 'open' check (status in ('open','received','cancelled')),
  data_origin           data_origin_type not null default 'client',
  upload_file_id        uuid references upload_files(id),
  created_at            timestamptz not null default now(),
  check (expected_arrival_date >= order_date)
);

-- ===== Settings (versioned) =====
create table settings_versions (
  id             uuid primary key default gen_random_uuid(),
  version_no     integer generated always as identity unique,
  schema_version integer not null default 1,
  params         jsonb not null,
  is_active      boolean not null default false,
  note           text,
  created_by     uuid references app_user_profile(user_id),
  created_at     timestamptz not null default now()
);
create unique index settings_one_active on settings_versions (is_active) where is_active;

-- ===== Forecasting =====
create table forecast_runs (
  id                  uuid primary key default gen_random_uuid(),
  target_series       text not null references series_catalog(series_id),
  origin_week_start   date not null check (extract(isodow from origin_week_start) = 1),
  status              run_status not null default 'queued',
  requested_by        uuid references app_user_profile(user_id),
  override_reason     text,
  queued_at           timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  data_hash           text,
  git_sha             text,
  config              jsonb not null default '{}'::jsonb,
  model_versions      jsonb,
  data_origin_summary jsonb not null default '{}'::jsonb,
  error               text
);
create index forecast_runs_lookup_idx on forecast_runs (target_series, status, origin_week_start desc);

create table forecast_values (
  run_id            uuid not null references forecast_runs(id) on delete cascade,
  horizon_week      smallint not null check (horizon_week between 1 and 12),
  target_week_start date not null,
  model_name        text not null check (model_name in ('persistence','seasonal_naive','ets','qgbm')),
  p10               numeric(18,6) not null,
  p50               numeric(18,6) not null,
  p90               numeric(18,6) not null,
  primary key (run_id, horizon_week),
  check (p10 <= p50 and p50 <= p90)
);

create table model_metrics (
  run_id       uuid not null references forecast_runs(id) on delete cascade,
  model_name   text not null,
  horizon_week smallint not null,
  metric       text not null check (metric in ('mape_p50','pinball_log','coverage_80','bias_log','n_origins')),
  value        numeric(18,8) not null,
  primary key (run_id, model_name, horizon_week, metric)
);

-- ===== Plans, recommendations, decisions =====
create table plan_runs (
  id                           uuid primary key default gen_random_uuid(),
  kind                         plan_kind not null default 'base',
  name                         text,
  domestic_forecast_run_id     uuid not null references forecast_runs(id),
  international_forecast_run_id uuid references forecast_runs(id),
  settings_version_id          uuid not null references settings_versions(id),
  inputs                       jsonb not null,
  overrides                    jsonb not null default '{}'::jsonb,
  solver_status                solver_status_type not null,
  fallback                     boolean not null default false,
  objective_value              numeric(20,4),
  result                       jsonb not null,   -- stock path, shortages, binding flags, totals by cost path
  created_by                   uuid references app_user_profile(user_id),
  created_at                   timestamptz not null default now()
);
create index plan_runs_created_idx on plan_runs (created_at desc);

create table plan_lines (
  plan_run_id             uuid not null references plan_runs(id) on delete cascade,
  week_index              smallint not null check (week_index between 0 and 11),
  week_start              date not null,
  route                   route_type not null,
  lots                    integer not null check (lots >= 0),
  tonnes                  numeric(14,3) not null check (tonnes >= 0),
  unit_cost_p50_inr_per_t numeric(14,2) not null,
  cost_low_inr            numeric(18,2) not null,
  cost_likely_inr         numeric(18,2) not null,
  cost_high_inr           numeric(18,2) not null,
  primary key (plan_run_id, week_index, route)
);

create table recommendations (
  id                  uuid primary key default gen_random_uuid(),
  plan_run_id         uuid not null references plan_runs(id),
  headline            text not null,
  reasons             jsonb not null,
  confidence          text not null check (confidence in ('low','medium','high')),
  review_date         date not null,
  facts               jsonb not null,
  snapshot            jsonb not null,
  explain_version     text not null,
  data_origin_summary jsonb not null default '{}'::jsonb,
  status              rec_status not null default 'pending',
  superseded_by       uuid references recommendations(id),
  created_by          uuid references app_user_profile(user_id),
  created_at          timestamptz not null default now()
);
create index recommendations_status_idx on recommendations (status, created_at desc);

create table decisions (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations(id),
  action            decision_action not null,
  modified_lines    jsonb,
  note              text,
  decided_by        uuid not null references app_user_profile(user_id),
  decided_at        timestamptz not null default now(),
  check (action <> 'modify' or modified_lines is not null)
);
create unique index decisions_one_per_recommendation on decisions (recommendation_id);

-- ===== Backtests =====
create table backtest_runs (
  id                  uuid primary key default gen_random_uuid(),
  status              run_status not null default 'queued',
  config              jsonb not null,
  demand_source       text not null check (demand_source in ('actual','synthetic')),
  requested_by        uuid references app_user_profile(user_id),
  queued_at           timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  data_hash           text,
  git_sha             text,
  library_versions    jsonb,
  data_origin_summary jsonb not null default '{}'::jsonb,
  error               text
);

create table backtest_results (
  run_id       uuid not null references backtest_runs(id) on delete cascade,
  window_label text not null default 'all',     -- 'all' or the window start date
  strategy     text not null check (strategy in ('soybuy','reorder_point','buy_as_needed','actual_reported','oracle')),
  metric       text not null,
  horizon_week smallint not null default 0,     -- 0 = not applicable
  value        numeric(18,8) not null,
  ci_low       numeric(18,8),
  ci_high      numeric(18,8),
  n_windows    integer,
  primary key (run_id, window_label, strategy, metric, horizon_week)
);

-- ===== Data quality and audit =====
create table data_quality_checks (
  id         bigint generated always as identity primary key,
  run_at     timestamptz not null default now(),
  check_name text not null,
  series_id  text,
  status     quality_status not null,
  detail     jsonb
);
create index dq_checks_run_idx on data_quality_checks (run_at desc);

create view data_quality_latest with (security_invoker = true) as
select distinct on (check_name, coalesce(series_id, '')) *
from data_quality_checks
order by check_name, coalesce(series_id, ''), run_at desc;

create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid references app_user_profile(user_id),
  actor_label text,                -- for example 'system:ingest_daily'
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb
);
create index audit_entity_idx on audit_log (entity, entity_id);

-- ===== Immutability triggers =====
create function forbid_update_delete() returns trigger language plpgsql as $$
begin
  raise exception '% on % is not allowed (insert-only table)', tg_op, tg_table_name;
end $$;

create trigger trg_decisions_insert_only before update or delete on decisions
  for each row execute function forbid_update_delete();
create trigger trg_audit_insert_only before update or delete on audit_log
  for each row execute function forbid_update_delete();

create function recommendations_guard() returns trigger language plpgsql as $$
begin
  if (new.id, new.plan_run_id, new.headline, new.reasons, new.confidence, new.review_date,
      new.facts, new.snapshot, new.explain_version, new.data_origin_summary, new.created_by, new.created_at)
     is distinct from
     (old.id, old.plan_run_id, old.headline, old.reasons, old.confidence, old.review_date,
      old.facts, old.snapshot, old.explain_version, old.data_origin_summary, old.created_by, old.created_at) then
    raise exception 'recommendations are immutable except status and superseded_by';
  end if;
  if old.status <> 'pending' and new.status <> old.status then
    raise exception 'recommendation in a terminal state cannot change status';
  end if;
  return new;
end $$;

create trigger trg_recommendations_guard before update on recommendations
  for each row execute function recommendations_guard();
create trigger trg_recommendations_no_delete before delete on recommendations
  for each row execute function forbid_update_delete();
