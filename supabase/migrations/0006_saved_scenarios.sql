-- ============================================================================
-- 0006_saved_scenarios.sql — remove the last in-memory store
-- Scenario saving previously lived in a module-level Python list that was lost
-- on restart. Persist it instead.
-- ============================================================================

create table if not exists saved_scenarios (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  overrides  jsonb not null,
  created_by uuid references app_user_profile(user_id),
  created_at timestamptz not null default now()
);

alter table saved_scenarios enable row level security;
drop policy if exists api_full_access on saved_scenarios;
create policy api_full_access on saved_scenarios
  for all to soybuy_api using (true) with check (true);

grant select, insert, update, delete on saved_scenarios to soybuy_api;
revoke all on saved_scenarios from anon, authenticated;
