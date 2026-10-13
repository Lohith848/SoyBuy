"""
Adapter for the real Agmarknet yearly CSV archive.

Source: https://github.com/iancovert/Agmarknet  (Soyabean/<year>.csv)
This is real government Agmarknet data (Directorate of Marketing & Inspection),
scraped and published for 2008–mid-2017. It is a DATED REAL SNAPSHOT, not a
synthetic series.

Raw columns (no header row):
  State Name, District Name, Market Name, Variety, Group,
  Arrivals (Tonnes), Min Price (Rs./Quintal), Max Price (Rs./Quintal),
  Modal Price (Rs./Quintal), Reported Date
Reported Date format: "01 Jan 2016".
"""

from __future__ import annotations

import csv
import datetime
import logging
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

_DATE_FMT = "%d %b %Y"


def _median(values: List[float]) -> float:
    s = sorted(values)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def read_year_csv(path: str) -> List[Dict[str, Any]]:
    """
    Returns canonical DOM_SOY_MANDI rows (one per state|market per day), with
    modal price converted from Rs./quintal to INR/t. Multiple varieties in the
    same market on the same day are aggregated by median.
    """
    # (dimension_key, obs_date) -> [modal prices], plus metadata
    agg: Dict[Tuple[str, datetime.date], Dict[str, Any]] = {}

    with open(path, "r", encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.reader(f):
            if not row or len(row) < 10:
                continue
            try:
                state = row[0].strip()
                district = row[1].strip()
                market = row[2].strip()
                modal_raw = float(row[8])
                obs_date = datetime.datetime.strptime(row[9].strip(), _DATE_FMT).date()
            except (ValueError, IndexError):
                continue
            if modal_raw <= 0:
                continue
            key = (f"{state.lower()}|{market.lower()}", obs_date)
            slot = agg.setdefault(key, {"prices": [], "state": state, "district": district})
            slot["prices"].append(modal_raw)

    rows: List[Dict[str, Any]] = []
    for (dimension_key, obs_date), slot in agg.items():
        median_raw = _median(slot["prices"])
        rows.append({
            "series_id": "DOM_SOY_MANDI",
            "dimension_key": dimension_key,
            "obs_date": obs_date.isoformat(),
            "value": round(median_raw * 10.0, 2),
            "raw_value": round(median_raw, 2),
            "raw_unit": "INR_per_quintal",
            "data_origin": "public",
            "note": (
                f"state={slot['state']}; district={slot['district']}; "
                f"quotes={len(slot['prices'])}; "
                "source=Agmarknet archive (github.com/iancovert/Agmarknet)"
            ),
        })
    return rows


def load_archive(dir_path: str, years: List[int]) -> List[Dict[str, Any]]:
    """Load and combine the given years from a directory of soyabean_<year>.csv."""
    import os

    out: List[Dict[str, Any]] = []
    for y in years:
        p = os.path.join(dir_path, f"soyabean_{y}.csv")
        if not os.path.exists(p):
            logger.warning("archive file missing: %s", p)
            continue
        rows = read_year_csv(p)
        logger.info("archive %s: %d canonical rows", y, len(rows))
        out.extend(rows)
    return out
