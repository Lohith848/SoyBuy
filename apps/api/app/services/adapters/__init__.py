"""
Data ingestion adapters.  Spec C.3 / E2.
Each adapter: fetch → parse → canonicalize → return list of dicts ready for upsert.
"""

from __future__ import annotations

import datetime
import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# data.gov.in is frequently slow to first byte; 30s produced ReadTimeout in
# testing on 2026-10-12. 90s is the confirmed-working ceiling from this host.
TIMEOUT = 90.0


# ---------------------------------------------------------------------------
# Agmarknet / data.gov.in  (DOM_SOY_MANDI)
# CONFIRMED live on 2026-10-12 (see docs/data-sources.md):
#   resource 9ef84268-d588-465a-a308-a864a43d0070  "Current Daily Price ..."
#   fields: state, district, market, commodity, variety, grade,
#           arrival_date (dd/mm/yyyy), min_price, max_price, modal_price (INR/quintal)
#   FILTER VALUE is "Soyabean" (no space) — "Soya bean" returns zero rows.
# LIMITATION: this resource exposes ONLY the current publish day, not history.
# ---------------------------------------------------------------------------

AGMARKNET_BASE = "https://api.data.gov.in/resource"
AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"


def _parse_dd_mm_yyyy(s: str) -> str | None:
    """Agmarknet returns arrival_date as dd/mm/yyyy; return ISO yyyy-mm-dd."""
    try:
        d, m, y = s.split("/")
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except (ValueError, AttributeError):
        return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def fetch_agmarknet_raw(
    api_key: str,
    commodity: str = "Soyabean",
    limit: int = 1000,
) -> list[dict[str, Any]]:
    """Raw records exactly as returned by the live data.gov.in resource."""
    url = f"{AGMARKNET_BASE}/{AGMARKNET_RESOURCE_ID}"
    params: dict[str, Any] = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
        "filters[commodity]": commodity,
    }
    # data.gov.in's gateway returns 502 for the default httpx UA; a browser UA
    # is required (confirmed 2026-10-12).
    headers = {"User-Agent": "Mozilla/5.0 (SoyBuy ingester)", "Accept": "application/json"}
    with httpx.Client(timeout=TIMEOUT, headers=headers) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    return data.get("records", [])


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def fetch_agmarknet_prices(
    api_key: str,
    commodity: str = "Soyabean",
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = 1000,
) -> list[dict[str, Any]]:
    """
    Canonical DOM_SOY_MANDI rows (INR/t). Real data only; nothing is synthesised.
    Returns list of dicts with:
      series_id, dimension_key, obs_date, value (INR/t), raw_value (INR/quintal),
      raw_unit, published_at, data_origin
    """
    records = fetch_agmarknet_raw(api_key, commodity=commodity, limit=limit)
    now = datetime.datetime.utcnow().isoformat() + "Z"

    # A single market may report several varieties/grades on the same day. The
    # canonical series is one modal price per mandi per day, so we aggregate the
    # real quotes by median (never inventing a value).
    agg: dict[tuple[str, str], dict[str, Any]] = {}
    for rec in records:
        try:
            state = str(rec.get("state", "")).strip()
            market = str(rec.get("market", "")).strip()
            district = str(rec.get("district", "")).strip()
            obs_date = _parse_dd_mm_yyyy(str(rec.get("arrival_date", "")).strip())
            modal_price_raw = float(rec.get("modal_price", 0))  # INR per quintal

            if not obs_date or modal_price_raw <= 0:
                continue
            if from_date and obs_date < from_date:
                continue
            if to_date and obs_date > to_date:
                continue

            key = (f"{state.lower()}|{market.lower()}", obs_date)
            slot = agg.setdefault(key, {"prices": [], "state": state,
                                        "district": district})
            slot["prices"].append(modal_price_raw)
        except (KeyError, ValueError, TypeError) as e:
            logger.warning("Skipping malformed Agmarknet record: %s – %s", rec, e)

    results = []
    for (dimension_key, obs_date), slot in agg.items():
        prices = sorted(slot["prices"])
        n = len(prices)
        median_raw = prices[n // 2] if n % 2 else (prices[n // 2 - 1] + prices[n // 2]) / 2.0
        results.append({
            "series_id": "DOM_SOY_MANDI",
            "dimension_key": dimension_key,
            "obs_date": obs_date,
            "value": round(median_raw * 10.0, 2),  # INR/quintal → INR/t
            "raw_value": round(median_raw, 2),
            "raw_unit": "INR_per_quintal",
            "published_at": now,
            "data_origin": "public",
            "note": (
                f"state={slot['state']}; district={slot['district']}; "
                f"quotes={n}; source=data.gov.in Agmarknet (current daily price)"
            ),
        })

    return results


# ---------------------------------------------------------------------------
# yfinance – CBOT soybean futures  (INT_FUT_SOY)
# [VERIFY] provider, symbol, delay, ToS
# ---------------------------------------------------------------------------

def fetch_cbot_futures(
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict[str, Any]]:
    """
    Returns list of dicts with:
      series_id=INT_FUT_SOY, obs_date, value (USD/t), raw_value (cents/bu), raw_unit
    [VERIFY] ZS=F is the unofficial Yahoo Finance symbol; confirm with the live feed.
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.error("yfinance not installed; cannot fetch futures prices")
        return []

    ticker = yf.Ticker("ZS=F")
    hist = ticker.history(period="2y" if not from_date else "max")

    if hist.empty:
        return []

    now = datetime.datetime.utcnow().isoformat() + "Z"
    results = []

    for date, row in hist.iterrows():
        obs_date = date.strftime("%Y-%m-%d")
        if from_date and obs_date < from_date:
            continue
        if to_date and obs_date > to_date:
            break

        close_cents_per_bu = float(row["Close"])  # [VERIFY] Yahoo returns cents/bu for ZS=F
        usd_per_t = close_cents_per_bu * 0.367437

        results.append({
            "series_id": "INT_FUT_SOY",
            "dimension_key": "",
            "obs_date": obs_date,
            "value": usd_per_t,
            "raw_value": close_cents_per_bu,
            "raw_unit": "US_cents_per_bushel",
            "published_at": now,
            "data_origin": "public",
            "note": "source=yfinance ZS=F [VERIFY]",
        })

    return results


# ---------------------------------------------------------------------------
# World Bank monthly commodity prices  (INT_WB_SOY)
# [VERIFY] file URL, series name, release timing
# ---------------------------------------------------------------------------

WB_PINK_SHEET_URL = (
    "https://thedocs.worldbank.org/en/doc/5d903e848db1d1b83e0ec8f744e55570-"
    "0350012021/related/CMO-Historical-Data-Monthly.xlsx"
)


def fetch_worldbank_monthly(
    from_date: str | None = None,
) -> list[dict[str, Any]]:
    """
    Returns list of monthly dicts for INT_WB_SOY.
    [VERIFY] series name 'Soybeans' and column in the Pink Sheet Excel.
    """
    try:
        import pandas as pd

        resp = httpx.get(WB_PINK_SHEET_URL, timeout=60, follow_redirects=True)
        resp.raise_for_status()

        import io
        # [VERIFY] sheet name, header row, soybean column name in the actual file
        df = pd.read_excel(io.BytesIO(resp.content), sheet_name="Monthly Prices",
                           header=4)

        # The date column is typically the first column; soybean is typically "Soybeans"
        # [VERIFY] exact column name
        date_col = df.columns[0]
        soy_col = "Soybeans"  # [VERIFY]

        results = []
        now = datetime.datetime.utcnow().isoformat() + "Z"

        for _, row in df.iterrows():
            try:
                raw_date = row[date_col]
                if hasattr(raw_date, "strftime"):
                    obs_date = raw_date.strftime("%Y-%m-%d")
                else:
                    obs_date = str(raw_date)[:10]

                if from_date and obs_date < from_date:
                    continue

                price = float(row.get(soy_col, 0))
                if price <= 0:
                    continue

                results.append({
                    "series_id": "INT_WB_SOY",
                    "dimension_key": "",
                    "obs_date": obs_date,
                    "value": price,
                    "raw_value": price,
                    "raw_unit": "USD_per_tonne",
                    "published_at": now,
                    "data_origin": "public",
                    "note": "source=WorldBank Pink Sheet [VERIFY]",
                })
            except (KeyError, ValueError, TypeError):
                continue

        return results

    except Exception as e:
        logger.error("WorldBank fetch failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# USD-INR rate  (FX_USDINR)
# [VERIFY] provider, field, quote direction
# ---------------------------------------------------------------------------

def fetch_fx_usdinr(
    from_date: str | None = None,
) -> list[dict[str, Any]]:
    """
    Returns list of daily FX dicts.
    Uses yfinance USDINR=X as a stand-in. [VERIFY] RBI reference rate.
    """
    try:
        import yfinance as yf

        ticker = yf.Ticker("USDINR=X")
        hist = ticker.history(period="2y" if not from_date else "max")

        if hist.empty:
            return []

        now = datetime.datetime.utcnow().isoformat() + "Z"
        results = []

        for date, row in hist.iterrows():
            obs_date = date.strftime("%Y-%m-%d")
            if from_date and obs_date < from_date:
                continue

            rate = float(row["Close"])  # INR per USD

            results.append({
                "series_id": "FX_USDINR",
                "dimension_key": "",
                "obs_date": obs_date,
                "value": rate,
                "raw_value": rate,
                "raw_unit": "INR_per_USD",
                "published_at": now,
                "data_origin": "public",
                "note": "source=yfinance USDINR=X [VERIFY]",
            })

        return results

    except Exception as e:
        logger.error("FX fetch failed: %s", e)
        return []
