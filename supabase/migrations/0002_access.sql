do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'soybuy_api') then
    create role soybuy_api nologin;
  end if;
end $$;

-- Browser-facing roles get nothing in the public schema.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- The API role gets table access (row security still applies, see the policies below).
grant usage on schema public to soybuy_api;
grant select, insert, update, delete on all tables in schema public to soybuy_api;
grant usage, select on all sequences in schema public to soybuy_api;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to soybuy_api;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to soybuy_api;

-- Row-level security on every table; the only policy lets the API role in.
do $$
declare r record;
begin  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    -- Idempotent: the ledger table may already carry the policy on a re-run.
    execute format('drop policy if exists api_full_access on public.%I', r.tablename);
    execute format(
      'create policy api_full_access on public.%I for all to soybuy_api using (true) with check (true)',
      r.tablename
    );
  end loop;
end $$;
