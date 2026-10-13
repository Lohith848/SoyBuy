"""Capture a real data.gov.in Agmarknet response as a test fixture."""
import json
import os
import sys
import datetime

sys.path.insert(0, os.path.abspath("apps/api"))
from dotenv import load_dotenv

load_dotenv()
from app.services.adapters import fetch_agmarknet_raw  # noqa: E402

key = os.getenv("DATA_GOV_IN_API_KEY")
assert key, "DATA_GOV_IN_API_KEY missing"
recs = fetch_agmarknet_raw(key, commodity="Soyabean", limit=1000)
print("fetched records:", len(recs))
dates = sorted({r.get("arrival_date") for r in recs})
print("distinct arrival_date:", dates)
if not recs:
    raise SystemExit("no records returned")

os.makedirs("apps/api/tests/fixtures", exist_ok=True)
stamp = datetime.date.today().isoformat()
path = f"apps/api/tests/fixtures/agmarknet_soybean_{stamp}.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(
        {
            "captured_at_utc": datetime.datetime.utcnow().isoformat() + "Z",
            "source": "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
            "commodity_filter": "Soyabean",
            "record_count": len(recs),
            "records": recs,
        },
        f,
        indent=2,
    )
print("fixture written:", path)
