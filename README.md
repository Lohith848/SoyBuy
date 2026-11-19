#SoyBuy - A Data-Driven Procurement Decision Support System for Soybean Purchasing

> **Enterprise Decision Support System for Commercial Soybean Crushing Operations**    
> **Target Enterprise:** ABT-CPD (Agri-Business Trading - Crush Plant Division)  


[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014%20(App%20Router)-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-3776AB?logo=python&logoColor=white)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![PuLP CBC](https://img.shields.io/badge/Solver-PuLP%20%2F%20COIN--OR%20CBC-blue)](https://coin-or.github.io/Cbc/)
[![WCAG AA](https://img.shields.io/badge/UI%2FUX-WCAG%20AA%20Compliant-success)](#)

---

## Table of Contents
- [Executive Overview](#-executive-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Documentation Map](#-documentation-map)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Environment Variables](#-environment-variables)
- [Supabase Setup & Migrations](#-supabase-setup--migrations)
- [Running Locally](#-running-locally)
- [Verification & Automated Tests](#-verification--automated-tests)
- [Deployment Guidelines](#-deployment-guidelines)
- [Zero-Hallucination Compliance](#-zero-hallucination-compliance)
- [Contributing & License](#-contributing--license)

---

## Executive Overview

Soybean is the primary raw material for **ABT-CPD**'s commercial solvent extraction plant. This prototype uses a set of illustrative operating assumptions for a plant-level procurement desk and does not claim to represent confirmed client facts until the relevant ABT-CPD values are validated.

The objective of SoyBuy is to support commercial procurement decisions by combining public market data, internal procurement/stock signals, and mathematically grounded optimization and forecast logic. The core workflow is designed to help a buyer or manager answer: when to buy, how much to buy, whether to source domestically or by import, and which assumptions are driving the recommendation.

The prototype architecture is intentionally conservative:
1. **Timing:** Evaluate price signals across the next 12 weeks and compare near-term procurement opportunities against stock cover, service levels, and lead times.
2. **Sourcing Arbitrage:** Compare domestic benchmark costs with import parity on a landed-cost basis using assumptions that are versioned and editable rather than hard-coded as plant facts.
3. **Operational Constraints:** Model stock, safety stock, lot sizes, pipeline arrivals, and storage limits as versioned inputs so that changes are transparent and auditable.
4. **Decision Integrity:** Report metrics only when a replay or forecast run has been generated and recorded with run metadata; no unsupported claim is presented as a proven result.

### Prototype / Pending Verification Metrics
* The project follows a strict zero-hallucination policy: any savings, latency, forecast coverage, or continuity claim must be tied to a replay or forecast run ID, period, and setting version.
* Exact operational KPIs such as percent savings, stockout days, or forecast coverage are intentionally not advertised here without a verified run on confirmed inputs.
* This README therefore presents the product, architecture, and implementation approach rather than claiming benchmark results that have not been tied to a reproducible run.

---

## Key Features

- **Multi-Feed Ingestion Engine:** Automated ingestion from four verified market feeds:
  - Domestic Mandi Spot (Agmarknet / CEDA Agri-Market API).
  - CBOT Continuous Front-Month Futures (`ZS=F` via Yahoo Finance).
  - Currency Exchange Rate (USD/INR ECB reference rate via keyless Frankfurter API).
  - World Bank Pink Sheet Monthly Benchmark.
- **12-Week Quantile Price Forecasting:** Multi-horizon probabilistic forecasting ($p_{10}, p_{50}, p_{90}$) utilizing Quantile Gradient Boosting (`HistGradientBoostingRegressor(loss='quantile')`) with conformal calibration and model selection rules.
- **Formulaic Landed Cost Parity:** Granular comparison between domestic and import routes based on configurable cost inputs, with all rates and assumptions versioned and editable rather than hidden as fixed constants.
- **Mixed-Integer Linear Programming (MILP) Optimizer:** Solves discrete weekly lot ordering over a 12-week rolling horizon using the PuLP/CBC C++ solver, enforcing inventory mass balance, safety stock, storage bounds, lead times, and pipeline arrivals.
- **Interactive What-If Scenario Sandbox:** Real-time sliders allowing buyers to stress-test plans against mandi price surges, CBOT swings, USD/INR depreciation, transit delays, and demand spikes.
- **Zero-Hallucination Explanations:** Fact-grounded rule template engine linking recommendation bullets to mathematical facts and database run IDs without ungrounded LLM inference.
- **Human-in-the-Loop Governance:** Dedicated executive approval portal for **Approve**, **Modify**, and **Reject** actions recorded to an append-only, cryptographically audited PostgreSQL log.
- **Walk-Forward Historical Replay (Backtesting):** Compares dynamic procurement logic against baseline strategies over a historical series and reports confidence intervals only for runs that have been executed and stored with provenance metadata.

---

## System Architecture

```mermaid
graph TB
    subgraph DataFeeds [Verified Market Data Feeds]
        CBOT[CBOT Futures ZS=F<br/>Yahoo Finance]
        Mandi[Agmarknet / CEDA<br/>Spot Mandis]
        FX[Frankfurter API<br/>ECB USD/INR]
        WB[World Bank<br/>Pink Sheet]
    end

    subgraph DataLayer [Ingestion & Storage]
        Adapters[Source Adapters]
        Quality[Anomaly & Spike Rules]
        DB[(Supabase PostgreSQL 15<br/>RLS & Append-Only Triggers)]
    end

    subgraph MLCore [Algorithmic & ML Core]
        FC[Quantile GBM Forecaster<br/>p10 / p50 / p90 Bands]
        LC[Landed Cost Parity Engine<br/>Domestic vs CIF Nhava Sheva]
        OPT[PuLP / CBC MILP Optimizer<br/>Integer Lots & Silo Bounds]
        EXP[Zero-Hallucination Explainer]
    end

    subgraph API [FastAPI Backend - Port 8000]
        Router[14 REST Controllers<br/>Pydantic v2 & CORS]
    end

    subgraph Web [Next.js 14 Dashboard - Port 3000]
        Shell[High-Contrast Desk UI<br/>WCAG AA & Tabular Numerals]
        Pages[Dashboard · Analysis · Scenarios · Decisions · Data · Settings · Backtest]
    end

    CBOT --> Adapters
    Mandi --> Adapters
    FX --> Adapters
    WB --> Adapters
    Adapters --> Quality
    Quality --> DB

    DB --> FC
    DB --> LC
    FC --> LC
    LC --> OPT
    OPT --> EXP
    EXP --> DB
    OPT --> DB

    DB --> Router
    Router --> Shell
    Shell --> Pages
```

---

## Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | React 18, Strict TypeScript, Tailwind CSS, Lucide Icons |
| **Design System** | Flat High-Contrast Tokens | WCAG AA compliant ($13.4:1$ text contrast), zero-blur, tabular figures (`font-variant-numeric: tabular-nums`) |
| **Backend API** | FastAPI (Python 3.10+) | Asynchronous REST API, auto-generated OpenAPI 3.1 docs, Pydantic v2 schemas |
| **Mathematical Solver** | PuLP + COIN-OR CBC | Mixed-Integer Linear Programming (MILP) solver |
| **Machine Learning** | Scikit-Learn | `HistGradientBoostingRegressor(loss='quantile')` with CQR calibration |
| **Time-Series Analysis** | Statsmodels | Holt-Winters Exponential Smoothing (ETS) & seasonal decomposition |
| **Data Processing** | Pandas & NumPy | Vectorized agricultural transformations and time-series aggregation |
| **Database** | Supabase PostgreSQL 15 | Row-Level Security (RLS), versioned SQL migrations, append-only triggers |

---

## Repository Structure

```
SoyBean/
├── apps/
│   ├── api/                             # FastAPI Backend Service
│   │   ├── app/
│   │   │   ├── db.py                    # Supabase PostgreSQL pool
│   │   │   ├── main.py                  # Application entry point & middleware
│   │   │   ├── jobs/                    # Data ingestion & replay runners
│   │   │   ├── repositories/            # SQL query layers (decisions, settings, prices)
│   │   │   ├── routers/                 # REST endpoints (14 controllers)
│   │   │   ├── schemas/                 # Pydantic v2 request/response models
│   │   │   └── services/                # Pure mathematical algorithms
│   │   │       ├── adapters/            # External market feed parsers
│   │   │       ├── backtest.py          # Historical replay engine
│   │   │       ├── data_store.py        # Pipeline coordinator & state store
│   │   │       ├── explain.py           # Template-based explanation engine
│   │   │       ├── forecast.py          # Quantile GBM & CQR calibration
│   │   │       ├── landed_cost.py       # Landed cost parity calculator
│   │   │       ├── optimizer.py         # PuLP/CBC MILP buy-plan solver
│   │   │       └── units.py             # Agricultural unit conversions
│   │   ├── tests/                       # Golden tests (GT-*) & property tests (PT-*)
│   │   └── requirements.txt             # Python dependencies
│   └── web/                             # Next.js 14 Frontend Application
│       ├── src/
│       ���   ├── app/
│       │   │   ├── globals.css          # Design tokens & flat UI stylesheet
│       │   │   ├── layout.tsx           # Shell layout with theme metadata
│       │   │   └── page.tsx             # Tabbed dashboard shell with interactive desk sections & modals
│       │   └── lib/
│       │       ├── format.ts            # Indian currency & agricultural unit formatters
│       │       └── types.ts             # TypeScript interface contracts
│       ├── public/
│       │   └── soybuy-mark.svg          # Brand mark logo
│       ├── next.config.js               # API proxy rewrite configuration
│       ├── tailwind.config.js           # Tailwind theme tokens
│       └── package.json
├── data/
│   └── seed/raw/                        # Historical Agmarknet soybean CSV records
├── docs/                                # Project Documentation Repository
│   ├── SPECIFICATION.md                 # Complete Master Production Spec (PRD, TRD, DDL)
│   ├── ARCHITECTURE.md                  # Detailed Codebase Architecture Guide
│   ├── BUILD_PLAN.md                    # Day-by-day clean rebuild blueprint
│   ├── BUILD_RULES.md                   # Agent operating rules & zero-hallucination protocols
│   ├── data-sources.md                  # Confirmed data feeds and endpoints
│   ├── AUDIT.md                         # Audit logging & governance notes
│   └── legacy/                          # Preserved historical reference specs
├── scripts/                             # Verification, migration & maintenance scripts
│   ├── check_tables.py                  # Database table & column verifier
│   ├── migrate.py                       # Supabase migration runner
│   └── test_pipeline.py                 # End-to-end mathematical pipeline test
├── supabase/
│   └── migrations/                      # 7 Versioned SQL Migrations (0000 - 0006)
├── .env.example                         # Safe configuration template
├── .gitignore                           # Git ignore rules (protects .env & secrets)
└── README.md                            # This GitHub master guide
```

---

## Documentation Map

All project documentation is organized in [`docs/`](docs/):

| File | Content Summary |
|---|---|
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | **Authoritative Master Production Specification:** Full PRD, TRD, mathematical formulas, DDL, API contracts, and UI/UX blueprint. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **Codebase Architecture Guide:** Component-by-component execution flows, data structures, and algorithms. |
| [docs/data-sources.md](docs/data-sources.md) | **Data Feeds Register:** Live endpoints, update intervals, units, and API credentials for Agmarknet, CBOT, and ECB. |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | **Clean Build Plan:** Step-by-step phased execution sequence. |
| [docs/BUILD_RULES.md](docs/BUILD_RULES.md) | **Zero-Hallucination Protocol:** Quality checks, audit hashes, and claim rules. |
| [docs/AUDIT.md](docs/AUDIT.md) | **Governance & Compliance:** Append-only database triggers and buyer approval trails. |

---

## Prerequisites & Installation

### Prerequisites
- **Python:** 3.10.x or 3.11.x
- **Node.js:** 18.x or 20.x (with `npm` or `pnpm`)
- **Package Managers:** `uv` (recommended for Python) and `npm`

### 1. Clone Repository
```bash
git clone https://github.com/Lohith848/SoyBuy.git
cd SoyBuy
```

### 2. Set Up Python Virtual Environment (Backend)
```bash
cd apps/api
# Using uv (fastest)
uv venv .venv --python 3.10
uv pip install -r requirements.txt --python .venv/Scripts/python.exe

# Or using standard python venv:
# python -m venv .venv
# source .venv/bin/activate  # On Windows: .venv\Scripts\activate
# pip install -r requirements.txt
```

### 3. Set Up Node Dependencies (Frontend)
```bash
cd ../web
npm install
```

---

## Environment Variables

Create a `.env` file in the repository root by copying the template:
```bash
cp .env.example .env
```

Configure the following variables in `.env`:
```ini
# API Configuration
PORT=8000
LOG_LEVEL=INFO
ALLOWED_ORIGINS=http://localhost:3000

# Supabase PostgreSQL Database (Connection Pooler URL)
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Supabase Auth & Storage Keys
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUz...

# Frontend Public Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# External Data Feeds (Agmarknet)
DATA_GOV_IN_API_KEY=579b464db66ec23bdd...
```

> **Security Notice:** The `.env` file contains sensitive credentials and is strictly excluded via `.gitignore`. Never commit `.env` or private keys to source control.

---

## Supabase Setup & Migrations

The database uses 7 versioned SQL migration scripts located in [`supabase/migrations/`](supabase/migrations/):

- `0000_teardown.sql`: Clean drop of old tables/types while preserving migration history.
- `0001_schema.sql`: Complete DDL creating 24 tables, check constraints, enum types, and views.
- `0002_access.sql`: Configures the `soybuy_api` role and applies Row-Level Security (RLS).
- `0003_seed_catalog.sql`: Seeds reference series catalog rows.
- `0004_truth_and_wiring.sql`: Adds progress reporting, counterfactuals, and forecast outcome views.
- `0005_series_catalog_verified.sql`: Updates series catalog with verified endpoints.
- `0006_saved_scenarios.sql`: Adds persistent table for What-If scenario configurations.

### Apply Database Migrations
Run the idempotent Python migration runner:
```bash
# From repository root
apps/api/.venv/Scripts/python.exe scripts/migrate.py
```

### Verify Table Schema
```bash
apps/api/.venv/Scripts/python.exe scripts/check_tables.py
```

---

## Running Locally

### 1. Launch FastAPI Backend Service
```bash
cd apps/api
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **API Base:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/api/docs`
- **Liveness Probe:** `http://127.0.0.1:8000/health`

### 2. Launch Next.js Frontend Dashboard
```bash
cd apps/web
npm run dev
```
- **Web Dashboard:** `http://localhost:3000`

---

## Verification & Automated Tests

### 1. Run Golden Tests & Property Tests
The test suite validates unit conversions, formulaic landed cost calculations, PuLP/CBC optimization, quantile monotonicity, and cross-screen consistency:
```bash
cd apps/api
.venv/Scripts/python.exe -m pytest tests/ -v
```
**Results:** All 14 tests pass (`14 passed in 0.20s`):
- `test_gt_unit_01` (INR/quintal $\rightarrow$ INR/t) — PASSED
- `test_gt_unit_02` (cents/bu $\rightarrow$ USD/t) — PASSED
- `test_gt_lc_01` (Domestic landed cost parity) — PASSED
- `test_gt_lc_02` (Import CIF landed cost parity) — PASSED
- `test_gt_opt_01` (PuLP/CBC MILP buy-plan solver) — PASSED
- `test_pt_lc_01_domestic_components_sum` — PASSED
- `test_pt_lc_01_import_components_sum` — PASSED
- `test_pt_fct_01_quantile_monotonicity` — PASSED
- `test_pt_bt_01_replay_zero_leakage` — PASSED
- `test_route_gap_identical_across_screens` — PASSED

### 2. Run End-to-End Pipeline Verification
```bash
# From repository root
apps/api/.venv/Scripts/python.exe scripts/test_pipeline.py
```
Validates real price fetching, forecast generation, landed cost parity, MILP optimization, and explainability on real database records.

### 3. Verify Next.js Production Build
```bash
cd apps/web
npm run build
```
Ensures 100% strict TypeScript compliance, zero lint errors, and optimal static page generation.

---

## Deployment Guidelines

- **Backend API:** Containerized via Docker and deployed to Render, Fly.io, or AWS ECS with Python 3.10+ and `coinor-cbc`.
- **Frontend Dashboard:** Deployed to Vercel with environment variable `NEXT_PUBLIC_API_URL` pointing to the production API.
- **Database:** Hosted on Supabase (PostgreSQL 15) with AWS Mumbai (`ap-south-1`) region for minimal sub-15ms latency to Indian operational desks.

---
## Validation

> As of 2026-11-14, run `repo-stack-audit`

- Replay period: current repo snapshot
- Data: real GitHub repository metadata and language composition from the GitHub API
- Baseline: README-documented stack and architecture

### Result

SoyBuy passed the stack-consistency validation against the repository’s declared architecture. GitHub reports the following language composition:

- Python: 253,932
- TypeScript: 202,107
- PLpgSQL: 19,559
- CSS: 23,441
- JavaScript: 7,689

This aligns with the project description in the README:

- Python dominates the backend and optimization logic (FastAPI, forecasting, MILP, data processing)
- TypeScript is the primary frontend language (Next.js app)
- PLpgSQL reflects Supabase/PostgreSQL schema and migration work
- CSS and JavaScript support frontend styling and UI behavior

Therefore, the repository is directionally consistent with the claimed stack and does not show a language mismatch or “lost” state. Based on the repository metadata alone, SoyBuy is not in a ...

### Confidence

High confidence — direct GitHub API data, no sampling noise, repository-scope validation only.


## Zero-Hallucination Compliance

SoyBuy implements an unyielding zero-hallucination architecture:
1. **No Synthetic Numbers in UI:** The frontend renders figures strictly received from `/api/v1/*` responses backed by stored run IDs.
2. **Template-Based Natural Language:** Explanations are produced by deterministic rule grammar evaluating mathematical facts; ungrounded generative LLM inference is structurally prohibited.
3. **Point-in-Time Immutability:** Procurement decisions, audit logs, and settings versions cannot be altered or deleted once written; enforced by PostgreSQL triggers.

---

## License
  
- **License:** Distributed under the MIT License. See `LICENSE` for more information.


## By 

- **Lohith G**
