"""
File Uploads API. Spec E.2 POST /uploads, GET /uploads.

Validates and persists client CSVs into the real client tables
(purchases / stock_snapshots / consumption_records / pipeline_orders /
lead_time_profiles) and records an upload_files row. Rows are inserted with
data_origin='client'; nothing is reported as "loaded" unless it was inserted.
"""

from __future__ import annotations

import csv
import datetime
import hashlib
import io
import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from app.db import get_connection
from app.services.blocked import BlockedCalculation

router = APIRouter()

KIND_TABLE = {
    "purchases": "purchases",
    "stock": "stock_snapshots",
    "consumption": "consumption_records",
    "pipeline": "pipeline_orders",
    "lead_times": "lead_time_profiles",
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


def _f(v):
    return float(str(v).strip())


def _d(v):
    return datetime.date.fromisoformat(str(v).strip()[:10])


def _validate_row(kind: str, row: dict) -> dict:
    """Return a canonical param dict for the target table, or raise ValueError."""
    if kind == "purchases":
        return {
            "purchase_date": _d(row["purchase_date"]),
            "route": row["route"].strip().lower(),
            "supplier": (row.get("supplier") or "").strip(),
            "quantity_t": _f(row["quantity_t"]),
            "price_inr_per_t": _f(row["price_inr_per_t"]),
            "price_basis": (row.get("price_basis") or "other").strip() or "other",
            "delivery_date": _d(row["delivery_date"]) if row.get("delivery_date") else None,
            "notes": row.get("notes"),
        }
    if kind == "stock":
        return {"snapshot_date": _d(row["snapshot_date"]), "quantity_t": _f(row["quantity_t"])}
    if kind == "consumption":
        return {
            "period_start": _d(row["period_start"]),
            "period_end": _d(row["period_end"]),
            "quantity_t": _f(row["quantity_t"]),
        }
    if kind == "pipeline":
        return {
            "route": row["route"].strip().lower(),
            "supplier": (row.get("supplier") or "").strip(),
            "order_date": _d(row["order_date"]),
            "expected_arrival_date": _d(row["expected_arrival_date"]),
            "quantity_t": _f(row["quantity_t"]),
            "status": (row.get("status") or "open").strip() or "open",
        }
    if kind == "lead_times":
        return {
            "route": row["route"].strip().lower(),
            "supplier": (row.get("supplier") or "").strip(),
            "origin": row.get("origin"),
            "lead_days": int(_f(row["lead_days"])),
            "effective_from": _d(row["effective_from"]),
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
}


@router.post("/uploads", response_model=UploadSummaryResponse)
async def upload_csv_file(
    file: UploadFile = File(...),
    kind: str = Form(...),
    mode: str = Form("partial"),
    quantity_unit: str = Form("t"),
    price_unit: str = Form("inr_per_t"),
    replace_overlaps: bool = Form(False),
):
    if kind not in KIND_TABLE:
        raise HTTPException(status_code=422, detail=f"kind must be one of {sorted(KIND_TABLE)}")

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
            raise BlockedCalculation("DATABASE_UNAVAILABLE", "Database unavailable.",
                                     ["database_unavailable"])

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
                "id": upload_id, "kind": kind, "filename": file.filename or "upload.csv",
                "path": f"uploads/{upload_id}", "sha256": sha256,
                "mode": "strict" if mode == "strict" else "partial",
                "qu": quantity_unit if quantity_unit in ("t", "kg", "quintal") else "t",
                "pu": price_unit if price_unit in ("inr_per_t", "inr_per_quintal", "inr_per_kg") else "inr_per_t",
                "total": total,
            },
        )

        for i, row in enumerate(rows, start=2):  # header is line 1
            try:
                params = _validate_row(kind, row)
                params["upload_id"] = upload_id
                conn.execute(text(_INSERT_SQL[kind]), params)
                loaded += 1
            except Exception as e:  # noqa: BLE001 - report per-row, don't abort
                errors.append({"line": i, "error": f"{type(e).__name__}: {e}"})

        rejected = total - loaded
        status = "loaded" if rejected == 0 and total > 0 else (
            "rejected" if loaded == 0 else "partially_loaded"
        )
        conn.execute(
            text("""update upload_files set status = cast(:status as upload_status),
                    rows_loaded = :loaded, rows_rejected = :rejected,
                    error_report = cast(:err as jsonb) where id = :id"""),
            {"status": status, "loaded": loaded, "rejected": rejected,
             "err": json.dumps(errors[:50]), "id": upload_id},
        )

    return UploadSummaryResponse(
        upload_id=upload_id, kind=kind, filename=file.filename or "upload.csv",
        total_rows=total, loaded_rows=loaded, rejected_rows=total - loaded,
        status=status, errors=errors[:50],
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
            {"upload_id": str(r[0]), "kind": str(r[1]), "filename": r[2], "status": str(r[3]),
             "rows_total": r[4], "rows_loaded": r[5], "rows_rejected": r[6],
             "uploaded_at": r[7].isoformat() if r[7] else None}
            for r in rows
        ]
        return {"items": items, "total": len(items)}
