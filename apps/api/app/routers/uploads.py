"""
File Uploads API. Master Spec E.2 POST /uploads, POST /uploads/validate, GET /uploads.

Validates and persists client CSVs into the real PostgreSQL tables
(purchases / stock_snapshots / consumption_records / pipeline_orders /
lead_time_profiles / price_observations) and records an upload_files row.
Rows are inserted with data_origin='client'; nothing is reported as "loaded" unless it was inserted.
"""

from __future__ import annotations

import csv
import datetime
import hashlib
import io
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from app.db import get_connection
from app.services.blocked import BlockedCalculation

logger = logging.getLogger(__name__)

router = APIRouter()

KIND_TABLE = {
    "purchases": "purchases",
    "stock": "stock_snapshots",
    "consumption": "consumption_records",
    "pipeline": "pipeline_orders",
    "lead_times": "lead_time_profiles",
    "prices": "price_observations",
    "mandi_prices": "price_observations",
    "usd_inr": "price_observations",
}

KIND_ALIASES = {
    "inventory": "stock",
    "procurement": "purchases",
    "procurement_history": "purchases",
    "demand": "consumption",
    "soybean_prices": "prices",
    "soybean prices": "prices",
    "mandi prices": "mandi_prices",
    "mandi": "mandi_prices",
    "usd inr": "usd_inr",
    "usd_inr_rate": "usd_inr",
    "fx": "usd_inr",
}


class UploadSummaryResponse(BaseModel):
    upload_id: str
    kind: str
    filename: str
    total_rows: int
    loaded_rows: int
    rejected_rows: int
    status: str
    errors: List[dict]


class UploadValidationResponse(BaseModel):
    kind: str
    filename: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    columns: List[str]
    preview_rows: List[Dict[str, Any]]
    errors: List[dict]


def _f(v: Any) -> float:
    return float(str(v).replace(",", "").strip())


def _d(v: Any) -> datetime.date:
    cleaned = str(v).strip()[:10]
    # support DD-MM-YYYY or YYYY-MM-DD
    if len(cleaned) == 10 and cleaned[2] == "-" and cleaned[5] == "-":
        parts = cleaned.split("-")
        return datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
    return datetime.date.fromisoformat(cleaned)


def _canonical_kind(k: str) -> str:
    cleaned = k.strip().lower()
    return KIND_ALIASES.get(cleaned, cleaned)


def _validate_row(kind: str, row: dict) -> dict:
    """Return a canonical param dict for the target table, or raise ValueError."""
    k = _canonical_kind(kind)
    if k == "purchases":
        dt = row.get("purchase_date") or row.get("date")
        if not dt:
            raise ValueError("Missing 'purchase_date' column")
        qty = row.get("quantity_t") or row.get("quantity") or row.get("tonnes")
        prc = row.get("price_inr_per_t") or row.get("price") or row.get("rate")
        return {
            "purchase_date": _d(dt),
            "route": (row.get("route") or "domestic").strip().lower(),
            "supplier": (row.get("supplier") or "Direct Mandi").strip(),
            "quantity_t": _f(qty),
            "price_inr_per_t": _f(prc),
            "price_basis": (row.get("price_basis") or "other").strip() or "other",
            "delivery_date": _d(row["delivery_date"]) if row.get("delivery_date") else None,
            "notes": row.get("notes"),
        }
    if k == "stock":
        dt = row.get("snapshot_date") or row.get("date")
        if not dt:
            raise ValueError("Missing 'snapshot_date' column")
        qty = row.get("quantity_t") or row.get("quantity") or row.get("stock_t")
        return {"snapshot_date": _d(dt), "quantity_t": _f(qty)}
    if k == "consumption":
        p_start = row.get("period_start") or row.get("start_date") or row.get("date")
        p_end = row.get("period_end") or row.get("end_date") or row.get("date")
        qty = row.get("quantity_t") or row.get("quantity") or row.get("crush_t")
        return {
            "period_start": _d(p_start),
            "period_end": _d(p_end),
            "quantity_t": _f(qty),
        }
    if k == "pipeline":
        dt = row.get("order_date") or row.get("date")
        arr = row.get("expected_arrival_date") or row.get("arrival_date")
        qty = row.get("quantity_t") or row.get("quantity")
        return {
            "route": (row.get("route") or "import").strip().lower(),
            "supplier": (row.get("supplier") or "").strip(),
            "order_date": _d(dt),
            "expected_arrival_date": _d(arr),
            "quantity_t": _f(qty),
            "status": (row.get("status") or "open").strip() or "open",
        }
    if k == "lead_times":
        eff = row.get("effective_from") or row.get("date")
        return {
            "route": (row.get("route") or "domestic").strip().lower(),
            "supplier": (row.get("supplier") or "").strip(),
            "origin": row.get("origin"),
            "lead_days": int(_f(row.get("lead_days") or row.get("days") or 7)),
            "effective_from": _d(eff),
        }
    if k == "prices":
        dt = row.get("obs_date") or row.get("date")
        val = row.get("value") or row.get("price") or row.get("rate")
        if not dt or val is None:
            raise ValueError("Missing 'obs_date' or 'value' column")
        series_id = (row.get("series_id") or "DOM_SOY_BENCH").strip().upper()
        return {
            "series_id": series_id,
            "dimension_key": "",
            "obs_date": _d(dt),
            "value": _f(val),
            "raw_unit": (row.get("raw_unit") or row.get("unit") or "INR/t").strip(),
        }
    if k == "mandi_prices":
        dt = row.get("obs_date") or row.get("date")
        val = row.get("value") or row.get("price")
        if not dt or val is None:
            raise ValueError("Missing 'obs_date' or 'value' column")
        mkt = (row.get("market") or row.get("mandi") or "Indore").strip()
        state = (row.get("state") or "Madhya Pradesh").strip()
        dim_key = f"{state.lower()}|{mkt.lower()}"
        return {
            "series_id": "DOM_SOY_MANDI",
            "dimension_key": dim_key,
            "obs_date": _d(dt),
            "value": _f(val),
            "raw_unit": (row.get("raw_unit") or row.get("unit") or "INR/quintal").strip(),
        }
    if k == "usd_inr":
        dt = row.get("obs_date") or row.get("date")
        val = row.get("value") or row.get("rate") or row.get("price")
        if not dt or val is None:
            raise ValueError("Missing 'obs_date' or 'value' column")
        return {
            "series_id": "FX_USD_INR",
            "dimension_key": "",
            "obs_date": _d(dt),
            "value": _f(val),
            "raw_unit": "INR/USD",
        }
    raise ValueError(f"unknown kind {kind!r}")


_INSERT_SQL = {
    "purchases": """insert into purchases
        (purchase_date, route, supplier, quantity_t, price_inr_per_t, price_basis,
         delivery_date, notes, data_origin, upload_file_id)
        values (:purchase_date, cast(:route as route_type), :supplier, :quantity_t,
                :price_inr_per_t, :price_basis, :delivery_date, :notes, 'client', :upload_id)""",
    "stock": """insert into stock_snapshots (snapshot_date, quantity_t, data_origin, upload_file_id)
        values (:snapshot_date, :quantity_t, 'client', :upload_id)
        on conflict (snapshot_date) do update set quantity_t = excluded.quantity_t,
          data_origin = 'client', upload_file_id = excluded.upload_file_id""",
    "consumption": """insert into consumption_records
        (period_start, period_end, quantity_t, data_origin, upload_file_id)
        values (:period_start, :period_end, :quantity_t, 'client', :upload_id)""",
    "pipeline": """insert into pipeline_orders
        (route, supplier, order_date, expected_arrival_date, quantity_t, status, data_origin, upload_file_id)
        values (cast(:route as route_type), :supplier, :order_date, :expected_arrival_date,
                :quantity_t, :status, 'client', :upload_id)""",
    "lead_times": """insert into lead_time_profiles
        (route, supplier, origin, lead_days, effective_from, data_origin, upload_file_id)
        values (cast(:route as route_type), :supplier, :origin, :lead_days, :effective_from, 'client', :upload_id)""",
    "prices": """insert into price_observations
        (series_id, dimension_key, obs_date, value, raw_value, raw_unit, published_at, data_origin, upload_file_id)
        values (:series_id, :dimension_key, :obs_date, :value, :value, :raw_unit, now(), 'client', :upload_id)
        on conflict (series_id, dimension_key, obs_date, revision) do update set
          value = excluded.value, raw_value = excluded.raw_value, upload_file_id = excluded.upload_file_id""",
    "mandi_prices": """insert into price_observations
        (series_id, dimension_key, obs_date, value, raw_value, raw_unit, published_at, data_origin, upload_file_id)
        values (:series_id, :dimension_key, :obs_date, :value, :value, :raw_unit, now(), 'client', :upload_id)
        on conflict (series_id, dimension_key, obs_date, revision) do update set
          value = excluded.value, raw_value = excluded.raw_value, upload_file_id = excluded.upload_file_id""",
    "usd_inr": """insert into price_observations
        (series_id, dimension_key, obs_date, value, raw_value, raw_unit, published_at, data_origin, upload_file_id)
        values (:series_id, :dimension_key, :obs_date, :value, :value, :raw_unit, now(), 'client', :upload_id)
        on conflict (series_id, dimension_key, obs_date, revision) do update set
          value = excluded.value, raw_value = excluded.raw_value, upload_file_id = excluded.upload_file_id""",
}


@router.post("/uploads/validate", response_model=UploadValidationResponse)
async def validate_csv_file(
    file: UploadFile = File(...),
    kind: str = Form(...),
):
    canonical = _canonical_kind(kind)
    if canonical not in KIND_TABLE:
        raise HTTPException(
            status_code=422,
            detail=f"kind '{kind}' is unsupported. Must be one of: {sorted(KIND_TABLE)}",
        )

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
    rows = list(reader)
    columns = reader.fieldnames or []
    total = len(rows)

    valid_count = 0
    duplicate_count = 0
    errors: List[dict] = []
    seen_keys = set()

    for i, row in enumerate(rows, start=2):
        try:
            params = _validate_row(canonical, row)
            # Duplicate check key based on canonical kind
            if canonical == "stock":
                key = str(params["snapshot_date"])
            elif canonical == "prices" or canonical == "mandi_prices" or canonical == "usd_inr":
                key = f"{params['series_id']}:{params.get('dimension_key','')}:{params['obs_date']}"
            elif canonical == "purchases":
                key = f"{params['purchase_date']}:{params['route']}:{params['supplier']}:{params['quantity_t']}"
            elif canonical == "consumption":
                key = f"{params['period_start']}:{params['period_end']}"
            else:
                key = str(params)

            if key in seen_keys:
                duplicate_count += 1
                errors.append({"line": i, "error": f"Duplicate record detected for key: {key}"})
            else:
                seen_keys.add(key)
                valid_count += 1
        except Exception as e:
            errors.append({"line": i, "error": f"{type(e).__name__}: {e}"})

    invalid_count = total - valid_count

    return UploadValidationResponse(
        kind=canonical,
        filename=file.filename or "uploaded.csv",
        total_rows=total,
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        duplicate_rows=duplicate_count,
        columns=list(columns),
        preview_rows=rows[:8],
        errors=errors[:30],
    )


@router.post("/uploads", response_model=UploadSummaryResponse)
async def upload_csv_file(
    file: UploadFile = File(...),
    kind: str = Form(...),
    mode: str = Form("partial"),
    quantity_unit: str = Form("t"),
    price_unit: str = Form("inr_per_t"),
    replace_overlaps: bool = Form(False),
):
    canonical = _canonical_kind(kind)
    if canonical not in KIND_TABLE:
        raise HTTPException(
            status_code=422,
            detail=f"kind '{kind}' is unsupported. Must be one of: {sorted(KIND_TABLE)}",
        )

    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
    rows = list(reader)
    total = len(rows)

    upload_id = str(uuid.uuid4())
    loaded = 0
    errors: List[dict] = []

    with get_connection() as conn:
        if conn is None:
            raise BlockedCalculation(
                "DATABASE_UNAVAILABLE", "Database unavailable.", ["database_unavailable"]
            )

        conn.execute(
            text("""
                insert into upload_files
                  (id, kind, filename, storage_path, sha256, mode, quantity_unit, price_unit,
                   status, rows_total, rows_loaded, rows_rejected, error_report, data_origin)
                values
                  (:id, cast(:kind as upload_kind), :filename, :path, :sha256,
                   :mode, :qu, :pu, 'validating', :total, 0, 0, '[]'::jsonb, 'client')
            """),
            {
                "id": upload_id,
                "kind": canonical,
                "filename": file.filename or "upload.csv",
                "path": f"uploads/{upload_id}",
                "sha256": sha256,
                "mode": "strict" if mode == "strict" else "partial",
                "qu": quantity_unit if quantity_unit in ("t", "kg", "quintal") else "t",
                "pu": price_unit
                if price_unit in ("inr_per_t", "inr_per_quintal", "inr_per_kg")
                else "inr_per_t",
                "total": total,
            },
        )

        for i, row in enumerate(rows, start=2):  # header is line 1
            try:
                params = _validate_row(canonical, row)
                params["upload_id"] = upload_id
                conn.execute(text(_INSERT_SQL[canonical]), params)
                loaded += 1
            except Exception as e:  # noqa: BLE001 - report per-row, don't abort
                errors.append({"line": i, "error": f"{type(e).__name__}: {e}"})

        rejected = total - loaded
        status = (
            "loaded"
            if rejected == 0 and total > 0
            else ("rejected" if loaded == 0 else "partially_loaded")
        )
        conn.execute(
            text("""update upload_files set status = cast(:status as upload_status),
                    rows_loaded = :loaded, rows_rejected = :rejected,
                    error_report = cast(:err as jsonb) where id = :id"""),
            {
                "status": status,
                "loaded": loaded,
                "rejected": rejected,
                "err": json.dumps(errors[:50]),
                "id": upload_id,
            },
        )

    # Recompute weekly series if market price data was ingested
    if canonical in ("prices", "mandi_prices", "usd_inr") and loaded > 0:
        try:
            from app.jobs.compute_weekly import compute_weekly_prices

            if canonical == "prices":
                compute_weekly_prices("DOM_SOY_BENCH")
                compute_weekly_prices("INT_FUT_SOY")
            elif canonical == "mandi_prices":
                compute_weekly_prices("DOM_SOY_MANDI")
                from app.jobs.import_snapshot import rebuild_domestic_benchmark

                rebuild_domestic_benchmark()
                compute_weekly_prices("DOM_SOY_BENCH")
            elif canonical == "usd_inr":
                compute_weekly_prices("FX_USD_INR")
        except Exception as exc:
            logger.warning("Weekly recompute note: %s", exc)

    return UploadSummaryResponse(
        upload_id=upload_id,
        kind=canonical,
        filename=file.filename or "upload.csv",
        total_rows=total,
        loaded_rows=loaded,
        rejected_rows=total - loaded,
        status=status,
        errors=errors[:50],
    )


@router.get("/uploads")
async def list_uploads():
    with get_connection() as conn:
        if conn is None:
            return {"items": [], "total": 0}
        rows = conn.execute(
            text("""select id, kind, filename, status, rows_total, rows_loaded, rows_rejected, uploaded_at
                    from upload_files order by uploaded_at desc limit 50""")
        ).fetchall()
        items = [
            {
                "upload_id": str(r[0]),
                "kind": str(r[1]),
                "filename": r[2],
                "status": str(r[3]),
                "rows_total": r[4],
                "rows_loaded": r[5],
                "rows_rejected": r[6],
                "uploaded_at": r[7].isoformat() if r[7] else None,
            }
            for r in rows
        ]
        return {"items": items, "total": len(items)}
