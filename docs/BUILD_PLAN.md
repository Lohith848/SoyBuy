# SoyBuy — Clean Build Plan (Rebuild From Scratch)
### Verified data sources, final stack, exact scaffold, design system, build order, and a hackathon-winning checklist

| Field | Value |
|---|---|
| Project | SoyBuy, PS-035, Sakthi Hackathon 2.0, Team SKH2-2026-00462 |
| Companion documents | `SoyBuy_Master_Spec.md` (formulas, full database DDL, API contract — still authoritative for those) and `SoyBuy_Master_Build_Prompt.md` (agent operating rules) |
| What this document adds | Real, checked data sources (not `[VERIFY]` placeholders), a final design system with contrast numbers, an exact repo scaffold, and a day-by-day plan to go from an empty folder to a submission |
| Scope | This is a clean rebuild. Delete the old repo's `app`/`src` folders entirely and start from the scaffold in section 3. Keep only this document, the Master Spec, and anything in section 2 you've already downloaded |

---

## 1. What's different this time, in one paragraph

The last build failed for one reason: it showed numbers nobody computed. Every fix below exists to make that structurally impossible — one function per calculation, every figure traced to a run id, nothing in the UI that didn't come from an API response, and real external data confirmed by actually checking the sources (section 2), not assumed from memory. The design is rebuilt flat, high-contrast, and dense with real charts instead of empty space, because the UI/UX prize is judged on a working, legible product, not decoration.

---

## 2. Data sources — checked just now, not guessed

Every source below was looked up live before writing this plan. Use these exact endpoints. Where a detail is still unconfirmed (marked `[VERIFY]`), it's a narrow detail — key signup, or an exact file URL — not the existence of the source itself.

### 2.1 International price — CBOT soybean futures

- **Source:** Yahoo Finance via the `yfinance` Python package. **Ticker: `ZS=F`** (continuous front-month CBOT soybean futures).
- **Unit as returned:** US cents per bushel (Yahoo shows it as USX). History available for many years at daily granularity — far more than the 52-week minimum, so the full quantile-GBM forecast model (which needs 156+ weeks) is achievable.
- **Confirmed by:** multiple independent sources (GitHub scripts, a cross-asset dashboard project, and a market-data site) all use `ZS=F` as the CBOT soybean ticker.
- **Conversion:** `USD_per_t = cents_per_bushel * 0.367437` (60 lb bushel, 1 t = 36.7437 bushels). This matches Master Spec C.3.2.
- **Pull command:**
  ```python
  import yfinance as yf
  df = yf.download("ZS=F", start="2010-01-01", auto_adjust=False)
  # df["Close"] is in cents/bushel; convert with the formula above
  ```
- **Roll behavior:** `ZS=F` is a continuous front-month series and will show jumps at contract rollover. Keep the jump-flag logic from Master Spec C.3.5 (5% weekly log-return threshold).
- **Risk:** Yahoo's unofficial endpoint can change or rate-limit. Cache every pull to the database immediately; never re-fetch on every request.

### 2.2 International price, long history and monthly cross-check — World Bank Pink Sheet

- **Source:** World Bank "Commodity Markets" (Pink Sheet), published monthly, confirmed to include a row for **Soybeans in $/mt (USD per tonne)** going back to at least 2010 in every monthly release checked.
- **Where:** `https://www.worldbank.org/en/research/commodity-markets` — the page publishes a monthly Excel workbook ("CMO Historical Data Monthly") with one tab of time series by commodity. **[VERIFY the exact current download link on that page]** — it moves slightly between releases, so don't hard-code last year's filename.
- **Use:** monthly cross-check against the weekly CBOT series (Master Spec C.3.7, the jump cross-check), and for seasonality analysis needing a long clean history.
- **Publication lag:** the Pink Sheet is typically released a few business days into the following month. Keep the conservative 35-day `publication_lag_days` default from the Master Spec unless you confirm the exact release day.

### 2.3 Exchange rate — USD/INR

- **Source: Frankfurter API** (`api.frankfurter.dev`, mirrored at `api.frankfurter.app`) — European Central Bank reference rates. **Free, no API key, no published rate limit, history back to 1999.** This is a stronger choice than anything marked `[VERIFY]` before: it's keyless and was confirmed working with real example calls.
- **Pull command (daily rate, base USD, target INR):**
  ```
  GET https://api.frankfurter.dev/v1/2015-01-01..?base=USD&symbols=INR
  ```
  Returns a JSON time series `{date: {"INR": rate}}`. For a single day: `GET https://api.frankfurter.dev/v1/2026-10-10?base=USD&symbols=INR`.
- **Note:** this is the ECB's own reference cross-rate (computed via EUR), not RBI's official reference rate. State this plainly in `docs/data-sources.md`. If ABT-CPD cares about the exact RBI rate for settlement, that's a client input to confirm later (`[VERIFY]`, not blocking for the prototype) — the ECB cross-rate is accurate enough for forecasting and comparison.
- **No weekend rate:** Frankfurter returns the last published rate on weekends/holidays, which is fine for the weekly aggregation in Master Spec C.3.3.

### 2.4 Domestic mandi prices — soybean, India

This is the trickiest source. Two real options, confirmed by search, with different tradeoffs:

| Option | What it is | Coverage | Reliability |
|---|---|---|---|
| **data.gov.in / Agmarknet, direct** | Official daily mandi price API, resource **"Current Daily Price of Various Commodities from Various Markets (Mandi)"**, confirmed resource id `a83bd1ad-ba46-41c7-9a80-c75537ce1172` on the related CKAN mirror; the primary access point is `api.data.gov.in` with a free API key | Current/recent days best; the official data.gov.in API has historically been described as **frequently down or blocked** | Low — treat as a "live top-up" source only |
| **CEDA Agri Market API (Ashoka University)** | A stable, id-based wrapper over the same Agmarknet data, **historical back to 2000**, documented at `agmarknet.ceda.ashoka.edu.in` | 2000–present, a few months' lag on the latest data | High — use this for backfill and for most historical modelling |

**Recommended approach:**
1. **Backfill with CEDA**: pull soybean modal prices for your chosen mandis back to at least 2015 (gives 500+ weeks — comfortably past the 156-week model minimum). CEDA is id-based (state/district/market/commodity all have numeric ids) — resolve names to ids first per its documented lookup endpoint.
2. **Daily top-up with data.gov.in**: register a free API key at `data.gov.in`, call the resource above filtered to `commodity=Soyabean` for your selected markets. Expect this to fail sometimes; the ingestion job must handle that failure without crashing (Master Spec F.3, "a source failure does not stop other sources").
3. **Unit:** both report **INR per quintal** — convert with `INR_per_t = INR_per_quintal * 10` (Master Spec C.3.2).
4. **Mandi selection is still a client input (OQ-01).** Don't guess which mandis ABT-CPD buys from — pick 3 to 5 well-covered soybean mandis in Madhya Pradesh or Maharashtra (the largest soybean-producing states) as a labelled team assumption for the prototype, and make the set editable in Settings exactly as the spec requires.
5. Record both adapters' confirmed field names and response shape in `docs/data-sources.md` the first time you successfully call them — don't code against the shape described here without checking the live response first.

### 2.5 What this means for the forecast model

With CBOT (`ZS=F`, years of daily history) and FX (Frankfurter, back to 1999) you can comfortably run the full model set from Master Spec C.5, including quantile gradient boosting. The domestic benchmark is the constrained one — if CEDA's backfill for your chosen mandis comes back short of 156 weeks after cleaning, the system should (per spec) automatically fall back to the simpler baselines for that series and say so on screen. That's a correct, honest outcome — not a failure.

---

## 3. Final stack (decided, not optional)

| Layer | Choice |
|---|---|
| Monorepo | `pnpm` workspaces, two packages: `apps/web`, `apps/api` |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy Core, asyncpg/psycopg |
| Data & ML | pandas, numpy, statsmodels (ETS), scikit-learn (quantile `HistGradientBoostingRegressor`), PuLP + CBC |
| Backend jobs | Same Python package, invoked as CLI entry points, scheduled by GitHub Actions cron |
| Database | Supabase Postgres, SQL migrations only (no ORM-managed schema) |
| Frontend | Next.js 14 (App Router), TypeScript strict, Tailwind CSS (tokens only, see section 5 — no arbitrary gradient classes) |
| Charts | Recharts (react, SVG, easy to theme flat) |
| Data fetching | TanStack Query, API client generated from the FastAPI OpenAPI schema |
| Forms | react-hook-form + zod |
| Auth | Supabase Auth |
| Hosting | Web on Vercel; API in a Docker container on Render or Fly.io (not Vercel functions — the ML stack is too heavy) |
| Testing | pytest + hypothesis (backend), vitest + Playwright (frontend) |

This matches the Master Spec's C.1 stack table exactly — nothing here contradicts it.

---

## 4. Exact repo scaffold

```bash
mkdir soybuy && cd soybuy
git init
pnpm init
mkdir -p apps/web apps/api supabase/migrations data/seed docs .github/workflows

# --- API ---
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" pydantic sqlalchemy "psycopg[binary]" \
  pandas numpy statsmodels scikit-learn pulp httpx tenacity yfinance pytest hypothesis ruff mypy
mkdir -p app/routers app/schemas app/services/adapters app/jobs tests/unit tests/integration tests/golden tests/property
touch app/__init__.py app/main.py app/config.py app/deps.py app/db.py
cd ../..

# --- Web ---
pnpm create next-app@latest apps/web --typescript --tailwind --app --eslint --no-src-dir=false
cd apps/web
pnpm add @tanstack/react-query recharts react-hook-form zod @supabase/ssr @supabase/supabase-js
pnpm add -D vitest @testing-library/react playwright openapi-typescript
cd ../..

# --- Supabase ---
# (requires the Supabase CLI installed separately)
supabase init
# Paste the schema from SoyBuy_Master_Spec.md Part D into:
#   supabase/migrations/0001_schema.sql
#   supabase/migrations/0002_access.sql
#   supabase/migrations/0003_seed_catalog.sql
supabase start
supabase db reset

git add -A && git commit -m "scaffold: empty monorepo, no app code yet"
```

**Do not hand-roll the database schema again.** Copy the DDL from `SoyBuy_Master_Spec.md` Part D verbatim into the three migration files above. If you believe something in that DDL is wrong, fix it there first, then run `supabase db reset` — never maintain two versions of the schema.

---

## 5. Design system — flat, high-contrast, checked against WCAG AA

No gradients, no glow, no blur, no glassmorphism, no decorative shadow. Borders and flat fills only. These exact values were checked for contrast (WCAG AA requires 4.5:1 for normal text, 3:1 for large text and UI borders) before being put in this document.


for frontend ui/ux use this folder C:\Users\Lohith G\Downloads\SoyBean\frontend use thid design 
### 5.3 Rules enforced in code

- `tailwind.config.ts` defines **only** the tokens above as theme colors. No arbitrary hex values in components — a lint rule should flag any `#` literal in a `className` or inline style outside the token file.
- No `linear-gradient`, `radial-gradient`, `backdrop-filter`, `blur()`, or `box-shadow` with blur radius greater than 2px anywhere. Flat 1px borders define every card and input.
- Numbers use `font-variant-numeric: tabular-nums` so figures align in tables and don't jitter when they update.
- Every chart has a **table view toggle** showing the same data as text (accessibility, and it also proves the chart isn't decorative).

### 5.4 Screen inventory (only real, wired screens — see Master Build Prompt NN-7)

| Screen | Purpose | Backed by |
|---|---|---|
| **Today** (was "Decision Hub") | Recommendation card, reasons, approve/modify/reject, headline stock/cost tiles | `/recommendations/latest`, `/forecast/latest`, `/data/status` |
| **Forecast** | 12-week band chart, model-per-horizon table, metrics | `/forecast/latest` |
| **Cost compare** | Domestic vs import component breakdown, per order week | `/landed-cost/compare` |
| **What-if** | Scenario sliders, base vs scenario delta | `/scenarios/run` |
| **Evidence** (was "Replay Proof") | Backtest results table with real intervals, strategy comparison, honest wording | `/backtests/{id}` — hidden until genuinely complete, per `/features` |
| **History & Seasonality** | Long price history, seasonal index | `/analysis/seasonality`, `/series/{id}/weekly` |
| **Data** | Source freshness, quality checks, CSV upload, manual market input, Refresh now | `/data/status`, `/uploads`, `/series/{id}/observations` |
| **Decisions** | Append-only decision log | `/decisions` |
| **Settings** | Full editable cost/inventory/lead-time settings, versioned | `/settings`, `/lead-times` |

Every one of these pulls from a real endpoint. None renders if its backing data isn't real and tested — gate with `GET /features`.

---

## 6. Build order (concise — Master Spec Part C has the formulas, this is just the sequence)

1. **Database** — apply the three migrations from section 4. Verify RLS and the immutability triggers actually reject bad writes (Master Spec D.4, D.3).
2. **Adapters** (section 2) — one module per source, each tested against a real saved response, each writing to `price_observations` with the right `data_origin`.
3. **Weekly aggregation + data-quality checks** — Master Spec C.3.3, C.3.7.
4. **Landed cost** — Master Spec C.6, one pure function, golden-tested against GT-LC-01/02.
5. **Forecast** — Master Spec C.5, walk-forward evaluated, model selected per horizon, calibrated.
6. **Optimizer** — Master Spec C.7, with the pre-checks and fallback heuristic.
7. **Explanation engine** — Master Spec C.9, template-only, no generated prose.
8. **API routers** — Master Spec Part E, plus the `/features` and `/pipeline/refresh` endpoints described in the Master Build Prompt.
9. **Replay/backtest** — Master Spec C.10, run on the real CBOT/FX/domestic series, with the block-bootstrap interval, multiple baselines, and honest wording.
10. **Frontend** — build screens in the order in section 5.4, wiring each to its real endpoint as you go, never before the endpoint is real.
11. **CI** — the literal-check and flat-design-check scripts from `SoyBuy_Master_Build_Prompt.md` section 7.

---

## 7. Day-by-day schedule (compressed, one builder + AI agent)

| Day | Focus |
|---|---|
| 1 | Scaffold (section 4), migrations applied, CI skeleton, hello-world deploy on both hosts |
| 2–3 | Adapters for all four real sources (2.1–2.4), weekly aggregation, data-quality checks, `docs/data-sources.md` filled in with confirmed shapes |
| 4 | Landed cost (pure function + golden tests), full Settings API and screen |
| 5–7 | Forecast: features, walk-forward evaluation, model selection, calibration, forecast run worker |
| 8–9 | Optimizer + explanation engine + recommendation endpoint |
| 10 | Scenario endpoint, What-if screen wired for real |
| 11–12 | Today, Forecast, Cost compare screens built against real endpoints |
| 13–14 | Data screen (upload, manual input, freshness, Refresh now), History & Seasonality screen |
| 15–17 | Backtest engine, Evidence screen (only unhidden once results are real and reproducible) |
| 18 | Auth, roles, Decisions screen, audit log |
| 19 | CI hardening (literal check, flat-design check, cross-screen consistency test), accessibility pass |
| 20 | Demo recording, deck, final docs pass, submission |

If Round 2 lands sooner, cut Evidence and History & Seasonality first — per `/features`, they simply don't appear rather than appearing broken.

---

## 8. Documentation deliverables (what judges actually read)

| Document | Contents |
|---|---|
| `README.md` | What SoyBuy does in 3 sentences, architecture diagram, how to run locally, how to run tests |
| `docs/data-sources.md` | For each source: confirmed endpoint, confirmed field names, unit, update frequency, date first checked — filled in as you build, never guessed in advance |
| `docs/architecture.md` | The system diagram from the Master Spec, plus any real deviations |
| `docs/runbook.md` | What to do when a source fails, how to re-run ingestion, how to restore a backup |
| The deck | 8–9 slides per Master Spec G.6, every number captioned with its run id |
| The video | Real screen recording per Master Spec G.6, showing a real Refresh now, a real slider move, a real approval |

---

## 9. Hackathon-winning checklist (map to what judges score)

| Judging angle | What proves it here |
|---|---|
| **Technical depth** | Real quantile forecasting with walk-forward evaluation, a real MILP optimizer with diagnostics, a replay engine with honest intervals — not a single script |
| **Correctness / no hallucination** | Every figure traces to a run id (provenance popover); CI literal-check proves no hard-coded numbers; cross-screen consistency test proves the dashboard and the cost tab can't disagree |
| **Completeness vs PS-035** | Every "Expected Solution" bullet in the problem statement maps to a real, wired screen (section 5.4) |
| **UI/UX prize** | Flat, WCAG-AA-checked design system; colorblind-safe route colors; table view on every chart; loading/empty/error states everywhere; no dead buttons |
| **Honesty / judgment** | Replay reports real intervals and will say plainly if SoyBuy loses to a baseline; "Manual view applied" and data-origin tags appear whenever a number isn't purely computed from public data |
| **Real-world readiness** | Every ABT-CPD-specific number (lot size, lead time, duty) is an editable, versioned setting, never a constant — matches how the client will actually adopt it after the hackathon |

Build in the order above, verify each phase against its own section before moving on, and don't let any screen go live until the endpoint behind it is real.
