"""Logical backup of every public table to JSON before the Phase 1 teardown."""
import json
import os
import datetime
import psycopg2
from dotenv import load_dotenv

load_dotenv()
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
out_dir = os.path.join("backup", f"pre_redesign_{ts}")
os.makedirs(out_dir, exist_ok=True)

conn = psycopg2.connect(os.getenv("DATABASE_URL"), connect_timeout=20)
cur = conn.cursor()
cur.execute("select tablename from pg_tables where schemaname='public' order by 1")
tables = [r[0] for r in cur.fetchall()]

summary = {}
for t in tables:
    cur.execute(f'select * from public."{t}"')
    cols = [d[0] for d in cur.description]
    rows = []
    for r in cur.fetchall():
        rows.append({c: (v.isoformat() if hasattr(v, "isoformat") else str(v) if not isinstance(v, (int, float, bool, type(None), dict, list)) else v)
                     for c, v in zip(cols, r)})
    with open(os.path.join(out_dir, f"{t}.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f)
    summary[t] = len(rows)

with open(os.path.join(out_dir, "_SUMMARY.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

conn.close()
print("Backup written to", out_dir)
for k, v in summary.items():
    print(f"  {k}\t{v}")
