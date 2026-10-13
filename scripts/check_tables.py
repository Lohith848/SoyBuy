import os
import dotenv
import psycopg2

dotenv.load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
tables = [
    'settings_versions', 'price_observations', 'weekly_prices', 
    'plan_runs', 'plan_lines', 'recommendations', 'decisions', 
    'audit_log', 'forecast_runs', 'forecast_values'
]
for t in tables:
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = %s 
        ORDER BY ordinal_position
    """, (t,))
    cols = [f"{r[0]} ({r[1]})" for r in cur.fetchall()]
    print(f"=== {t} ===")
    print("  " + ", ".join(cols))
conn.close()
