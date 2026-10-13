-- ============================================================================
-- 0000_teardown.sql  —  Phase 1.2  (Master Build Prompt §2.2)
--
-- Explicit, auditable teardown of the pre-redesign SoyBuy public schema.
-- Every object is named individually (no blanket `drop schema public cascade`)
-- so this teardown is reviewable in the pull request.
--
-- NOTE: the `_migrations` ledger table created by scripts/migrate.py is NOT
-- dropped here — it is migration-runner tooling, not application schema, and
-- scripts/migrate.py writes to it immediately after this file runs.
-- The Supabase-managed helper `public.rls_auto_enable` is likewise left alone.
-- ============================================================================

-- 1) Views (drop before their base tables) -----------------------------------
drop view if exists public.forecast_outcomes;
drop view if exists public.data_quality_latest;
drop view if exists public.price_latest;

-- 2) Tables ------------------------------------------------------------------
drop table if exists public.app_user_profile            cascade;
drop table if exists public.audit_log                   cascade;
drop table if exists public.backtest_results            cascade;
drop table if exists public.backtest_runs               cascade;
drop table if exists public.consumption_records         cascade;
drop table if exists public.data_quality_checks         cascade;
drop table if exists public.decisions                   cascade;
drop table if exists public.forecast_runs               cascade;
drop table if exists public.forecast_values             cascade;
drop table if exists public.ingest_runs                 cascade;
drop table if exists public.lead_time_profiles          cascade;
drop table if exists public.mandi_selection             cascade;
drop table if exists public.model_metrics               cascade;
drop table if exists public.pipeline_orders             cascade;
drop table if exists public.plan_lines                  cascade;
drop table if exists public.plan_runs                   cascade;
drop table if exists public.price_observations          cascade;
drop table if exists public.purchases                   cascade;
drop table if exists public.recommendation_counterfactuals cascade;
drop table if exists public.recommendations             cascade;
drop table if exists public.refresh_runs                cascade;
drop table if exists public.series_catalog              cascade;
drop table if exists public.settings_versions           cascade;
drop table if exists public.stock_snapshots             cascade;
drop table if exists public.upload_files                cascade;
drop table if exists public.weekly_prices               cascade;

-- 3) Functions (triggers are removed with their tables) ----------------------
drop function if exists public.forbid_update_delete()   cascade;
drop function if exists public.recommendations_guard()  cascade;

-- 4) Enumerated types --------------------------------------------------------
drop type if exists public.app_role           cascade;
drop type if exists public.data_origin_type   cascade;
drop type if exists public.decision_action    cascade;
drop type if exists public.plan_kind          cascade;
drop type if exists public.quality_status     cascade;
drop type if exists public.rec_status         cascade;
drop type if exists public.route_type         cascade;
drop type if exists public.run_status         cascade;
drop type if exists public.solver_status_type cascade;
drop type if exists public.upload_kind        cascade;
drop type if exists public.upload_status      cascade;
