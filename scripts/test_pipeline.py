import sys
import os
sys.path.insert(0, os.path.abspath("apps/api"))
import dotenv
dotenv.load_dotenv()

from app.services.data_store import store

print("1. Testing get_latest_prices():", flush=True)
prices = store.get_latest_prices()
print(f"   Prices: {prices}", flush=True)

print("\n2. Testing generate_or_get_forecast():", flush=True)
fc = store.generate_or_get_forecast()
print(f"   Model: {fc.model_name}, Run ID: {fc.run_id}, Horizons: {len(fc.horizons)}", flush=True)
print(f"   Week 0 p10={fc.horizons[0].p10}, p50={fc.horizons[0].p50}, p90={fc.horizons[0].p90}", flush=True)

print("\n3. Testing compute_landed_costs():", flush=True)
lc = store.compute_landed_costs()
print(f"   Week 0 Domestic landed: {lc[0]['domestic']['total']}, Imported: {lc[0]['imported']['total']}", flush=True)

print("\n4. Testing build_buy_plan():", flush=True)
plan = store.build_buy_plan()
print(f"   Solver status: {plan.solver_status}, Plan lines: {len(plan.plan_lines)}", flush=True)
print(f"   Spend summary: {plan.cost_summary_inr}", flush=True)

print("\n5. Testing generate_recommendation():", flush=True)
rec = store.generate_recommendation()
print(f"   Headline: {rec.headline}", flush=True)
print(f"   Confidence: {rec.confidence}", flush=True)
print(f"   Reasons count: {len(rec.reasons)}", flush=True)
for r in rec.reasons:
    print(f"     - [{r.id}] {r.text}", flush=True)

print("\nALL PIPELINE CHECKS PASSED SUCCESSFULLY ON REAL DATA!", flush=True)
