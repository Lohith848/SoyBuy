"""
Real-data seed loader for SoyBuy.

Loads ONLY real, sourced data into price_observations / weekly_prices:
  - INT_FUT_SOY : real CBOT soybean futures snapshot (soybean_futures.csv, ZS=F)
  - FX_USDINR   : real USD/INR snapshot (usd_inr.csv, INR=X)
  - DOM_SOY_MANDI : live data.gov.in Agmarknet current daily mandi prices
  - DOM_SOY_BENCH : derived median of the real DOM_SOY_MANDI observations

There is NO synthetic price generation here. The previous
`import_domestic_mandi_benchmark()` (hand-picked yearly bases + sin/cos noise)
was deleted in Phase 1/2 because it fabricated market history and mislabelled
it data_origin='public'.
"""

from __future__ import annotations

import csv
import datetime
import logging
import os
import sys
import uuid

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
load_dotenv()
logger = logging.getLogger(__name__)

SNAPSHOT_TAG = "2026-10-11"


def get_db_conn():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    return conn


def _record_ingest_run(cur, source: str, n_rows: int, status: str = "succeeded") -> str:
    run_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO ingest_runs (id, source, started_at, finished_at, status, rows_inserted)
        VALUES (%s, %s, now(), now(), %s::run_status, %s)
        """,
        (run_id, source, status, n_rows),
    )
    return run_id


_INSERT_OBS = """
    INSERT INTO price_observations
      (series_id, dimension_key, obs_date, value, raw_value, raw_unit,
       published_at, data_origin, note, ingest_run_id)
    VALUES %s
    ON CONFLICT (series_id, dimension_key, obs_date, revision) DO UPDATE SET
      value = EXCLUDED.value,
      raw_value = EXCLUDED.raw_value,
      published_at = EXCLUDED.published_at,
      note = EXCLUDED.note;
"""


def _bulk_insert(cur, rows, run_id: str) -> None:
    execute_values(
        cur,
        _INSERT_OBS,
        [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], run_id) for r in rows],
        template="(%s, %s, %s, %s, %s, %s, %s, %s::data_origin_type, %s, %s)",
        page_size=1000,
    )


# ---------------------------------------------------------------------------
# Real snapshots (present in the repo, fetched from Yahoo Finance on 2026-10-11)
# ---------------------------------------------------------------------------

def _read_yahoo_csv(csv_path: str):
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 3 or not row or not row[0]:
                continue
            try:
                yield datetime.date.fromisoformat(row[0].strip()), float(row[1])
            except (ValueError, IndexError):
                continue


def import_cbot_futures(csv_path: str) -> int:
    rows = []
    now = datetime.datetime.utcnow().isoformat() + "Z"
    for dt, close_cents in _read_yahoo_csv(csv_path):
        rows.append((
            "INT_FUT_SOY", "", dt, round(close_cents * 0.367437, 2), close_cents,
            "US_cents_per_bushel", now, "public",
            f"source=snapshot:soybean_futures.csv@{SNAPSHOT_TAG}",
        ))
    if not rows:
        return 0
    conn = get_db_conn()
    cur = conn.cursor()
    run_id = _record_ingest_run(cur, "snapshot:soybean_futures.csv", len(rows))
    _bulk_insert(cur, rows, run_id)
    conn.close()
    return len(rows)


def import_usd_inr(csv_path: str) -> int:
    rows = []
    now = datetime.datetime.utcnow().isoformat() + "Z"
    for dt, rate in _read_yahoo_csv(csv_path):
        rows.append((
            "FX_USDINR", "", dt, round(rate, 4), rate, "INR_per_USD", now, "public",
            f"source=snapshot:usd_inr.csv@{SNAPSHOT_TAG}",
        ))
    if not rows:
        return 0
    conn = get_db_conn()
    cur = conn.cursor()
    run_id = _record_ingest_run(cur, "snapshot:usd_inr.csv", len(rows))
    _bulk_insert(cur, rows, run_id)
    conn.close()
    return len(rows)


# ---------------------------------------------------------------------------
# Live Agmarknet (real current daily mandi prices)
# ---------------------------------------------------------------------------

def import_domestic_mandi_live() -> int:
    """Fetch real current-day Soyabean mandi prices from data.gov.in."""
    from app.services.adapters import fetch_agmarknet_prices

    api_key = os.getenv("DATA_GOV_IN_API_KEY")
    if not api_key:
        raise RuntimeError("DATA_GOV_IN_API_KEY not set")

    records = fetch_agmarknet_prices(api_key, commodity="Soyabean", limit=1000)
    now = datetime.datetime.utcnow().isoformat() + "Z"
    rows = []
    for r in records:
        rows.append((
            r["series_id"], r["dimension_key"],
            datetime.date.fromisoformat(r["obs_date"]),
            r["value"], r["raw_value"], r["raw_unit"], now, "public", r["note"],
        ))
    if not rows:
        return 0
    conn = get_db_conn()
    cur = conn.cursor()
    run_id = _record_ingest_run(cur, "data.gov.in:agmarknet_current_daily", len(rows))
    _bulk_insert(cur, rows, run_id)
    conn.close()
    return len(rows)


def import_domestic_archive(years=(2014, 2015, 2016, 2017)) -> int:
    """
    Load the real Agmarknet yearly CSV archive (2008–2017 scrape) from
    data/seed/raw into DOM_SOY_MANDI. This is a DATED REAL SNAPSHOT used to give
    the domestic series real history; it is not synthetic.
    """
    from app.services.adapters.agmarknet_archive import load_archive

    here = os.path.dirname(os.path.abspath(__file__))          # apps/api/app/jobs
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(here))))
    dir_path = os.path.join(root, "data", "seed", "raw")
    raw = load_archive(dir_path, list(years))
    now = datetime.datetime.utcnow().isoformat() + "Z"
    rows = [
        (r["series_id"], r["dimension_key"], datetime.date.fromisoformat(r["obs_date"]),
         r["value"], r["raw_value"], r["raw_unit"], now, "public", r["note"])
        for r in raw
    ]
    if not rows:
        return 0
    conn = get_db_conn()
    cur = conn.cursor()
    run_id = _record_ingest_run(cur, "snapshot:agmarknet_archive_2014_2017", len(rows))
    _bulk_insert(cur, rows, run_id)
    conn.close()
    return len(rows)


def rebuild_domestic_benchmark() -> int:
    """
    Derive DOM_SOY_BENCH as the real per-day median of the ingested
    DOM_SOY_MANDI observations. No values are invented here.
    """
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        WITH med AS (
            SELECT obs_date,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS med_value,
                   count(*) AS n_obs
            FROM price_observations
            WHERE series_id = 'DOM_SOY_MANDI' AND NOT is_excluded
            GROUP BY obs_date
        )
        INSERT INTO price_observations
          (series_id, dimension_key, obs_date, value, raw_value, raw_unit,
           published_at, data_origin, note)
        SELECT 'DOM_SOY_BENCH', '', obs_date, round(med_value::numeric, 2),
               round((med_value / 10.0)::numeric, 2), 'INR_per_t', now(), 'public',
               'derived: median of DOM_SOY_MANDI (' || n_obs || ' real markets)'
        FROM med
        ON CONFLICT (series_id, dimension_key, obs_date, revision) DO UPDATE SET
          value = EXCLUDED.value, raw_value = EXCLUDED.raw_value,
          published_at = EXCLUDED.published_at, note = EXCLUDED.note
        """
    )
    n = cur.rowcount
    _record_ingest_run(cur, "derived:DOM_SOY_BENCH", n)
    conn.close()
    return n


def run_full_import():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    cbot_csv = os.path.join(base_dir, "soybean_futures.csv")
    fx_csv = os.path.join(base_dir, "usd_inr.csv")

    print("[1/4] CBOT futures (INT_FUT_SOY) ...", flush=True)
    print("      rows:", import_cbot_futures(cbot_csv), flush=True)

    print("[2/4] USD/INR (FX_USDINR) ...", flush=True)
    print("      rows:", import_usd_inr(fx_csv), flush=True)

    print("[3/5] Live Agmarknet mandi (DOM_SOY_MANDI) ...", flush=True)
    print("      rows:", import_domestic_mandi_live(), flush=True)

    print("[4/5] Real Agmarknet archive 2014-2017 (DOM_SOY_MANDI history) ...", flush=True)
    print("      rows:", import_domestic_archive(), flush=True)

    print("[5/5] Derived benchmark (DOM_SOY_BENCH) ...", flush=True)
    print("      rows:", rebuild_domestic_benchmark(), flush=True)

    from app.jobs.compute_weekly import compute_weekly_prices
    n_weekly = compute_weekly_prices()
    print("Weekly aggregation rows:", n_weekly, flush=True)


if __name__ == "__main__":
    run_full_import()
