"""
Phase 1.5 verification.
  1. Table inventory + column counts
  2. RLS enabled + exactly one api_full_access policy per table, nothing for anon/authenticated
  3. Immutability trigger tests (decisions, audit_log, recommendations)
  4. Row count + data_origin provenance breakdown
  5. Enum type presence
Everything runs against the live database. Trigger tests run inside a
transaction that is always rolled back.
"""
import os
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv("DATABASE_URL"), connect_timeout=20)
conn.autocommit = False
cur = conn.cursor()

SPEC_TABLES = [
    "app_user_profile", "series_catalog", "mandi_selection", "ingest_runs",
    "price_observations", "weekly_prices", "upload_files", "lead_time_profiles",
    "purchases", "stock_snapshots", "consumption_records", "pipeline_orders",
    "settings_versions", "forecast_runs", "forecast_values", "model_metrics",
    "plan_runs", "plan_lines", "recommendations", "decisions", "backtest_runs",
    "backtest_results", "data_quality_checks", "audit_log", "refresh_runs",
    "recommendation_counterfactuals",
]

print("=" * 70)
print("1) TABLE INVENTORY")
print("=" * 70)
cur.execute("select tablename from pg_tables where schemaname='public' order by 1")
actual = [r[0] for r in cur.fetchall()]
missing = [t for t in SPEC_TABLES if t not in actual]
extra = [t for t in actual if t not in SPEC_TABLES and t != "_migrations"]
print(f"tables present: {len(actual)} (incl. _migrations ledger)")
print(f"spec tables missing: {missing or 'NONE'}")
print(f"unexpected extra tables: {extra or 'NONE'}")
for t in SPEC_TABLES:
    cur.execute(
        "select count(*) from information_schema.columns where table_schema='public' and table_name=%s",
        (t,),
    )
    print(f"  {t:32s} cols={cur.fetchone()[0]}")

print()
print("=" * 70)
print("2) ROW LEVEL SECURITY")
print("=" * 70)
cur.execute("select tablename, rowsecurity from pg_tables where schemaname='public' order by 1")
rls = cur.fetchall()
print("tables WITHOUT RLS:", [t for t, r in rls if not r] or "NONE (good)")

cur.execute(
    "select tablename, policyname, roles::text, cmd from pg_policies where schemaname='public' order by 1,2"
)
pols = cur.fetchall()
bad = [p for p in pols if p[1] != "api_full_access" or "soybuy_api" not in p[2]]
print(f"policies total: {len(pols)}; non-api_full_access or non-soybuy_api roles: {bad or 'NONE (good)'}")
print("anon/authenticated policies:", [p for p in pols if "anon" in p[2] or "authenticated" in p[2]] or "NONE (good)")

print()
print("=" * 70)
print("3) IMMUTABILITY TRIGGER TESTS (rolled back)")
print("=" * 70)


def expect_blocked(label, fn):
    try:
        fn()
        conn.rollback()
        print(f"  FAIL  {label}: operation was ALLOWED (should be rejected)")
    except Exception as e:
        conn.rollback()
        msg = str(e).strip().splitlines()[0]
        print(f"  OK    {label}: rejected -> {msg}")


def expect_allowed(label, fn):
    try:
        fn()
        print(f"  OK    {label}: allowed as expected")
        conn.rollback()
    except Exception as e:
        conn.rollback()
        print(f"  FAIL  {label}: unexpectedly rejected -> {str(e).splitlines()[0]}")


# --- audit_log (insert-only) ---
def t_audit():
    cur.execute("insert into audit_log (action, entity) values ('t','t')")
    cur.execute("update audit_log set action='x' where entity='t'")


expect_blocked("UPDATE audit_log is rejected", t_audit)


def t_audit_del():
    cur.execute("insert into audit_log (action, entity) values ('t','t')")
    cur.execute("delete from audit_log where entity='t'")


expect_blocked("DELETE audit_log is rejected", t_audit_del)

# --- build FK chain for recommendations / decisions ---
def build_chain():
    cur.execute("insert into settings_versions (params) values ('{}'::jsonb) returning id")
    sv = cur.fetchone()[0]
    cur.execute(
        """insert into forecast_runs (target_series, origin_week_start, status)
           values ('DOM_SOY_BENCH','2026-10-05','succeeded') returning id"""
    )
    fr = cur.fetchone()[0]
    cur.execute(
        """insert into plan_runs (domestic_forecast_run_id, settings_version_id, inputs, solver_status, result)
           values (%s,%s,'{}'::jsonb,'optimal','{}'::jsonb) returning id""",
        (fr, sv),
    )
    pr = cur.fetchone()[0]
    cur.execute(
        """insert into recommendations
             (plan_run_id, headline, reasons, confidence, review_date, facts, snapshot, explain_version)
           values (%s,'h','[]'::jsonb,'high','2026-10-19','{}'::jsonb,'{}'::jsonb,'v1') returning id""",
        (pr,),
    )
    return cur.fetchone()[0]


build_chain()
conn.rollback()

# --- decisions (insert-only) needs a user profile row ---
def t_decisions_update():
    rec_id = build_chain()
    cur.execute(
        """insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                                   email_confirmed_at, created_at, updated_at)
           values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
                   'authenticated','authenticated','verify@soybuy.local','', now(), now(), now())
           returning id"""
    )
    uid = cur.fetchone()[0]
    cur.execute("insert into app_user_profile (user_id, email) values (%s,'verify@soybuy.local')", (uid,))
    cur.execute(
        """insert into decisions (recommendation_id, action, decided_by)
           values (%s,'approve',%s)""",
        (rec_id, uid),
    )
    cur.execute("update decisions set note='x' where recommendation_id=%s", (rec_id,))


expect_blocked("UPDATE decisions is rejected", t_decisions_update)


def t_rec_immutable():
    rec_id = build_chain()
    cur.execute("update recommendations set headline='changed' where id=%s", (rec_id,))


expect_blocked("UPDATE recommendations immutable field is rejected", t_rec_immutable)


def t_rec_status_ok():
    rec_id = build_chain()
    cur.execute("update recommendations set status='approved' where id=%s", (rec_id,))


expect_allowed("UPDATE recommendations SET status IS allowed", t_rec_status_ok)

print()
print("=" * 70)
print("4) ROW COUNTS + DATA-ORIGIN PROVENANCE")
print("=" * 70)
cur.execute(
    """select series_id, data_origin, count(*), min(obs_date), max(obs_date)
       from price_observations group by 1,2 order by 1,2"""
)
for sid, origin, n, mn, mx in cur.fetchall():
    print(f"  price_observations {sid:16s} origin={origin:8s} rows={n:6d} {mn}..{mx}")
cur.execute("select series_id, count(*), min(week_start), max(week_start) from weekly_prices group by 1 order by 1")
for sid, n, mn, mx in cur.fetchall():
    print(f"  weekly_prices      {sid:16s} rows={n:6d} {mn}..{mx}")
for t in ["purchases", "stock_snapshots", "consumption_records", "pipeline_orders", "decisions", "audit_log", "settings_versions", "series_catalog"]:
    cur.execute(f"select count(*) from {t}")
    print(f"  {t:20s} rows={cur.fetchone()[0]}")

print()
print("=" * 70)
print("5) ENUM TYPES")
print("=" * 70)
cur.execute(
    """select typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
       where n.nspname='public' and t.typtype='e' order by 1"""
)
print("  enums:", [r[0] for r in cur.fetchall()])

conn.rollback()
conn.close()
print("\nDONE.")
