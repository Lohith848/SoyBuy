"""
Series API. Spec E.2 GET /series/{series_id}/weekly, /daily and
POST /series/{series_id}/observations (manual market inputs).

Reads go through the real repository. There is no synthetic fallback: if a
series has no rows, the response is an explicit empty list.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db import get_connection
from app.repositories.prices import get_weekly_prices
from app.services.blocked import BlockedCalculation

router = APIRouter()


class ManualObservationRequest(BaseModel):
    obs_date: str = Field(..., description="Date YYYY-MM-DD")
    value: float = Field(..., description="Value in canonical unit")
    unit: str = "INR/t"
    location_name: Optional[str] = None
    note: Optional[str] = None
    data_origin: str = "manual"


@router.get("/series/{series_id}/weekly")
async def get_weekly(series_id: str, from_date: str | None = None, to_date: str | None = None):
    """Weekly price observations for a series (real data only)."""
    rows = get_weekly_prices(series_id, from_date, to_date)
    return {
        "series_id": series_id,
        "rows": [
            {
                "week_start": r["week_start"],
                "value": r["value"],
                "n_obs": r["n_obs"],
                "is_imputed": r["is_imputed"],
                "quality_flag": r["quality_flag"],
                "known_at": r["known_at"],
            }
            for r in rows
        ],
    }


@router.get("/series/{series_id}/daily")
async def get_daily(series_id: str, from_date: str | None = None, to_date: str | None = None):
    """Daily price observations for a series (real data only)."""
    with get_connection() as conn:
        if conn is None:
            return {"series_id": series_id, "rows": []}
        result = conn.execute(
            text(
                """
                select obs_date, value, raw_value, raw_unit, data_origin
                from price_observations
                where series_id = :sid
                  and (:dfrom is null or obs_date >= cast(:dfrom as date))
                  and (:dto is null or obs_date <= cast(:dto as date))
                  and not is_excluded
                order by obs_date, revision
                """
            ),
            {"sid": series_id, "dfrom": from_date, "dto": to_date},
        )
        rows = [
            {
                "obs_date": str(r[0]),
                "value": float(r[1]) if r[1] is not None else None,
                "raw_value": float(r[2]) if r[2] is not None else None,
                "raw_unit": r[3],
                "data_origin": r[4],
            }
            for r in result.fetchall()
        ]
    return {"series_id": series_id, "rows": rows}


@router.post("/series/{series_id}/observations")
async def add_manual_observation(series_id: str, payload: ManualObservationRequest):
    """
    Manual market input (PS-035 requirement). Persists the real human-entered
    quote to price_observations and rebuilds the weekly aggregate.
    """
    import uuid
    from datetime import date as _date

    obs_id = f"obs-{uuid.uuid4().hex[:8]}"
    dimension_key = "" if series_id == "DOM_SOY_BENCH" else (
        f"manual|{(payload.location_name or '').strip().lower()}"
    )

    try:
        obs_date = _date.fromisoformat(payload.obs_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="obs_date must be YYYY-MM-DD")

    with get_connection() as conn:
        if conn is None:
            raise BlockedCalculation("DATABASE_UNAVAILABLE", "Database unavailable.",
                                     ["database_unavailable"])
        conn.execute(
            text("""
                insert into price_observations
                  (series_id, dimension_key, obs_date, value, raw_value, raw_unit,
                   published_at, data_origin, note)
                values
                  (:sid, :dk, :od, :value, :raw, :unit, now(), 'manual', :note)
                on conflict (series_id, dimension_key, obs_date, revision) do update set
                  value = excluded.value, raw_value = excluded.raw_value,
                  published_at = excluded.published_at, note = excluded.note
            """),
            {
                "sid": series_id, "dk": dimension_key, "od": obs_date,
                "value": payload.value, "raw": payload.value, "unit": payload.unit,
                "note": (payload.note or ""),
            },
        )

    from app.jobs.compute_weekly import compute_weekly_prices
    recomputed = compute_weekly_prices(series_id)
    if series_id in ("DOM_SOY_MANDI", "DOM_SOY_BENCH"):
        try:
            from app.jobs.import_snapshot import rebuild_domestic_benchmark
            rebuild_domestic_benchmark()
            recomputed += compute_weekly_prices("DOM_SOY_BENCH")
        except Exception:
            pass

    return {
        "status": "success",
        "observation_id": obs_id,
        "series_id": series_id,
        "obs_date": payload.obs_date,
        "value": payload.value,
        "location": payload.location_name,
        "note": payload.note,
        "weekly_rows_recomputed": recomputed,
        "message": f"Manual observation persisted for {series_id}.",
    }
