# SoyBuy Baseline Audit (Step 0)

| ID | Finding | Status | Evidence (File & Line) | Action / Work Package |
|---|---|---|---|---|
| F-01 | Market series look generated, not ingested | Confirmed | `apps/api/app/services/data_store.py:52` `_init_mock_history()` | WP-1: Ingest real CSVs & Agmarknet into `price_observations` |
| F-02 | API serves numbers without a database | Confirmed | `apps/api/app/services/data_store.py:41` in-memory fallback | WP-1: Gate API on Postgres database; `/ready` requires DB |
| F-03 | Forecast values look typed, not modelled | Confirmed | `apps/api/app/services/data_store.py:126` round numbers | WP-2: Implement real quantile/ARIMA/STL forecast engine |
| F-04 | History is shorter than the model needs | Confirmed | `apps/api/app/services/data_store.py:67` only 52 weeks | WP-1, WP-2: Ingest 156+ weeks from real snapshots (2015–2026) |
| F-05 | Figures disagree between screens | Confirmed | `apps/web/src/app/page.tsx` hardcoded fallback literals | WP-3: Single landed cost function & stored `plan_runs` result |
| F-06 | A test constant appears as a live figure | Confirmed | `apps/web/src/app/page.tsx:787` 50,023.73 | WP-3: Remove test constants from application code |
| F-07 | Band width and confidence disagree | Confirmed | `apps/api/app/services/explain.py:88` inconsistent logic | WP-4: Compute `band_rel_4w` once from stored forecast |
| F-08 | A seeded decision is fabricated | Confirmed | `apps/api/app/services/data_store.py` seeded initial decisions | WP-1: Empty decision log on start; audit log append-only |
| F-09 | "Proven savings" rest on sample data | Confirmed | `apps/web/src/app/page.tsx:1073` "Achieved 4.18% Savings" | WP-5: Honest historical replay with confidence intervals |
| F-10 | No test behind the leakage claim | Confirmed | `apps/api/tests/` lacks `PT-BT-01` and `PT-FCT-02` | WP-5, WP-10: Implement point-in-time leakage property tests |
| F-11 | Frontend may compute locally | Confirmed | `apps/web/src/app/page.tsx` contained client math | WP-6, WP-7: All numbers computed server-side, frontend formats only |
| F-12 | Settings are incomplete and hide constants | Confirmed | `apps/api/app/services/landed_cost.py` hidden magic numbers | WP-3: Migrate all constants to `settings_versions` & `units.py` |
| F-13 | PS-035 requirements are missing from the UI | Confirmed | Missing real data upload, STL decomposition, data freshness | WP-8: Add dedicated data, history, and STL screens |
| F-14 | Decorative claims | Confirmed | `page.tsx` "Zero-Hallucination Protocol Compliant" badge | WP-8: Remove unverified claims; replace with Sources provenance |
| F-15 | Large import advantage is unexplained | Confirmed | `optimizer.py` output lacked binding constraint marginals | WP-4: Add `explain_marginal` and binding constraint inspection |
| F-16 | One file holds the whole UI | Confirmed | `apps/web/src/app/page.tsx` was 1,555 lines | WP-7: Clean design tokens applied, splitting into modular views |
| F-17 | No real user | Confirmed | `apps/web/src/app/page.tsx` fixed "Lead Buyer" | WP-7: Wire real Supabase Auth sessions |
| F-18 | Narrative text is hard-coded | Confirmed | `apps/api/app/services/explain.py` hardcoded Kharif reason | WP-4: Derive seasonal narrative strictly from STL index |
| F-19 | Visual issues | Confirmed | `globals.css` and `tailwind.config.js` had glows/glassmorphism | WP-7: Refactored to flat design tokens (D-1 through D-9) |
