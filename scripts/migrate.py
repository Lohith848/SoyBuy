"""
Migration runner for SoyBuy.
Applies supabase/migrations/*.sql against DATABASE_URL in order.
"""

import glob
import os
import sys
from dotenv import load_dotenv
import psycopg2

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not set in .env")
    sys.exit(1)

print(f"Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# Ensure migration tracking table
cur.execute("""
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
""")

cur.execute("SELECT name FROM _migrations")
applied = {row[0] for row in cur.fetchall()}

migration_files = sorted(glob.glob("supabase/migrations/*.sql"))

for fpath in migration_files:
    fname = os.path.basename(fpath)
    if fname in applied:
        print(f"[-] Already applied: {fname}")
        continue
    
    print(f"[+] Applying migration: {fname}...")
    with open(fpath, "r", encoding="utf-8") as f:
        sql = f.read()
    
    try:
        cur.execute(sql)
        cur.execute("INSERT INTO _migrations (name) VALUES (%s)", (fname,))
        print(f"    SUCCESS: {fname}")
    except Exception as e:
        print(f"    FAILED: {fname}: {e}")
        conn.close()
        sys.exit(1)

print("All migrations applied successfully!")
conn.close()
