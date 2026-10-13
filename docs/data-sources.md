# SoyBuy — Data Sources (verified against live calls)

Every entry below was **inspected by calling the real endpoint / opening the real
file**, not coded from memory. Anything unconfirmed is marked `[VERIFY]`.
`series_catalog.verified_on` is updated from this file (migration `0005`).

| Series | Source | Endpoint / file | Fields (real) | Raw unit | Canonical unit | Cadence | Key needed | Status |
|---|---|---|---|---|---|---|---|---|
| `DOM_SOY_MANDI` | data.gov.in Agmarknet "Current Daily Price" | `GET https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=…&format=json&filters[commodity]=Soyabean` | `state, district, market, commodity, variety, grade, arrival_date (dd/mm/yyyy), min_price, max_price, modal_price` | INR/quintal | INR/t | daily (current day only) | `DATA_GOV_IN_API_KEY` | ✅ CONFIRMED 2026-10-12 |
| `DOM_SOY_MANDI` (history) | Agmarknet yearly CSV archive | `data/seed/raw/soyabean_<year>.csv` (from `github.com/iancovert/Agmarknet`) | `State,District,Market,Variety,Group,Arrivals,Min,Max,Modal,Reported Date` (no header) | INR/quintal | INR/t | daily, 2014–2017 | — | ✅ REAL DATED SNAPSHOT |
| `DOM_SOY_BENCH` | derived (real only) | median of `DOM_SOY_MANDI` per day | — | INR/t | INR/t | weekly | — | ✅ CONFIRMED 2026-10-12 |
| `INT_FUT_SOY` | Yahoo Finance ZS=F snapshot | `soybean_futures.csv` (repo) | `Date,Close,High,Low,Open,Volume` | US cents/bushel | USD/t | daily | — | ✅ CONFIRMED 2026-10-11 |
| `FX_USDINR` | Yahoo Finance INR=X snapshot | `usd_inr.csv` (repo) | `Date,Close,High,Low,Open,Volume` | INR/USD | INR/USD | daily | — | ✅ CONFIRMED 2026-10-11 |
| `INT_WB_SOY` | World Bank Pink Sheet | `CMO-Historical-Data-Monthly.xlsx` | `[VERIFY]` sheet/column | USD/t | USD/t | monthly | — | ⚠️ NOT INGESTED |
| `DOM_SOY_ARRIVAL` | data.gov.in Agmarknet | same resource as above | price-only; arrivals not present in this resource | `[VERIFY]` | t | daily | key | ⚠️ NOT INGESTED |

## Confirmed findings (2026-10-12)

### Agmarknet (data.gov.in) — `DOM_SOY_MANDI`
- **Resource ID `9ef84268-d588-465a-a308-a864a43d0070`** returns HTTP 200 with real data.
- **Filter value must be `Soyabean`** (no space). `Soya bean` returns **0 rows** — the previous adapter used the wrong string and would have silently ingested nothing.
- `arrival_date` is **`dd/mm/yyyy`**, not ISO. Parser converts to ISO.
- `modal_price`, `min_price`, `max_price` are **INR per quintal**. Canonical value = `modal_price × 10` (INR/t).
- **A market can publish several rows per day** (different `variety`/`grade`). One real day produced 395 Soyabean rows across 8 states; after aggregating to one modal price per market/day we get **312** distinct `DOM_SOY_MANDI` observations. Adapter aggregates by **median** (no values invented).
- **`limit=1000` returns the full current-day set** (395). Real captured fixture: `apps/api/tests/fixtures/agmarknet_soybean_2026-10-12.json`.
- ⚠️ **This resource is "current daily price" — it does NOT expose history.** A live call returned a **single** `arrival_date`. Indian mandi *history* is not available from this open API (CEDA's Agri-Market portal hosts it but is account-gated). **This is the reason the domestic forecast is blocked**: `DOM_SOY_BENCH` has 1 real week, and the forecaster requires 52.
- Gateway behaviour: data.gov.in intermittently returns **502** for the default `httpx` User-Agent and is slow (>30 s). The adapter sets a browser UA and a 90 s timeout.

### Yahoo Finance snapshots — `INT_FUT_SOY`, `FX_USDINR`
- Real dated snapshots committed in the repo (retrieved 2026-10-11), ~11 years daily:
  - `INT_FUT_SOY`: 2,959 rows, `2015-01-02 … 2026-10-09`.
  - `FX_USDINR`: 3,065 rows, `2015-01-01 … 2026-10-11`.
- `[VERIFY]` for production: contract roll treatment for `ZS=F`; RBI reference rate as the intended official FX source.

## Removal / relabelling log
- **Deleted** `import_domestic_mandi_benchmark()` — it fabricated `DOM_SOY_BENCH` from hand-picked yearly bases and `sin`/`cos` noise while labelling it `data_origin='public'`. This was the single largest fabrication in the repo.
- All `data_origin` values now reflect the truth: `public` for the two real snapshots + the real current mandi day; nothing fabricated remains.

### Agmarknet yearly CSV archive — `DOM_SOY_MANDI` history
- Real government Agmarknet data (Directorate of Marketing & Inspection), scraped by
  `github.com/iancovert/Agmarknet` for **2008–mid 2017**. Downloaded 2014–2017 and stored in
  `data/seed/raw/` (`soyabean_2014.csv` … `soyabean_2017.csv`).
- **No header row.** Columns: `State, District, Market, Variety, Group, Arrivals (t),
  Min (Rs/quintal), Max (Rs/quintal), Modal (Rs/quintal), Reported Date`.
- `Reported Date` format is **`01 Jan 2016`** (`%d %b %Y`), not ISO.
- Values are **Rs/quintal** → canonical `× 10` = INR/t. Arrival figures may be quoted with
  thousands separators (`"1,391.60"`).
- 174,852 raw rows across 2014–2017 → aggregated to one median modal price per market/day.
- ⚠️ **Data ends June 2017.** There is a real coverage gap 2017 → today; only the live
  current day bridges it. The forecast therefore uses a series with a large gap, which
  widens prediction bands. This is a data-availability fact, not a modelling choice.

## Capability status after history ingest (verified 2026-10-12)
- `forecast`: **true** — 183 real weeks of `DOM_SOY_BENCH` (≥ 52).
- `landed_cost`, `optimizer`, `scenarios`: **true**.
- `backtest`: **false** — no succeeded run stored → `409 no_succeeded_backtest_run`.

## Recommended next source step
For a *current* forecast, add real Indian mandi coverage for 2018→present
(CEDA Agri-Market portal, account-gated) so the series has no multi-year gap.
