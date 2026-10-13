"""
Prices repository.
Reads and writes real price observations and weekly series in PostgreSQL.
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from app.db import get_connection


def get_weekly_prices(
    series_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Returns weekly series ordered by week_start ascending.
    """
    with get_connection() as conn:
        if conn is None:
            return []
        
        query = """
            SELECT series_id, week_start, value, n_obs, is_imputed, quality_flag, known_at
            FROM weekly_prices
            WHERE series_id = :series_id
        """
        params: Dict[str, Any] = {"series_id": series_id}
        if from_date:
            query += " AND week_start >= :from_date"
            params["from_date"] = from_date
        if to_date:
            query += " AND week_start <= :to_date"
            params["to_date"] = to_date

        query += " ORDER BY week_start ASC"
        if limit:
            query += f" LIMIT {limit}"

        res = conn.execute(text(query), params)
        rows = []
        for r in res.fetchall():
            rows.append({
                "series_id": r[0],
                "week_start": r[1].isoformat() if hasattr(r[1], "isoformat") else str(r[1]),
                "value": float(r[2]) if r[2] is not None else 0.0,
                "n_obs": r[3],
                "is_imputed": r[4],
                "quality_flag": r[5],
                "known_at": r[6].isoformat() if hasattr(r[6], "isoformat") else str(r[6]) if r[6] else None,
            })
        return rows


def get_latest_weekly_price(series_id: str) -> Optional[Dict[str, Any]]:
    """
    Returns the most recent weekly price point for a series.
    """
    with get_connection() as conn:
        if conn is None:
            return None
        res = conn.execute(
            text("""
                SELECT series_id, week_start, value, known_at
                FROM weekly_prices
                WHERE series_id = :series_id
                ORDER BY week_start DESC
                LIMIT 1
            """),
            {"series_id": series_id}
        )
        row = res.fetchone()
        if not row:
            return None
        return {
            "series_id": row[0],
            "week_start": row[1].isoformat() if hasattr(row[1], "isoformat") else str(row[1]),
            "value": float(row[2]) if row[2] is not None else 0.0,
            "known_at": row[3].isoformat() if hasattr(row[3], "isoformat") else str(row[3]) if row[3] else None,
        }


def get_series_status() -> List[Dict[str, Any]]:
    """
    Returns coverage and freshness status for each catalog series.
    """
    with get_connection() as conn:
        if conn is None:
            return []
        res = conn.execute(
            text("""
                SELECT 
                    c.series_id,
                    c.description,
                    c.canonical_unit,
                    c.source_name,
                    min(w.week_start) as min_date,
                    max(w.week_start) as max_date,
                    count(w.week_start) as n_weeks,
                    max(w.known_at) as last_published
                FROM series_catalog c
                LEFT JOIN weekly_prices w ON c.series_id = w.series_id
                GROUP BY c.series_id, c.description, c.canonical_unit, c.source_name
                ORDER BY c.series_id
            """)
        )
        today = datetime.date.today()
        status_list = []
        for r in res.fetchall():
            max_dt = r[5]
            age_days = (today - max_dt).days if max_dt else 9999
            status = "ok" if age_days <= 14 else ("warn" if age_days <= 30 else "stale")
            status_list.append({
                "series_id": r[0],
                "description": r[1],
                "unit": r[2],
                "source": r[3],
                "min_date": r[4].isoformat() if r[4] else None,
                "max_date": r[5].isoformat() if r[5] else None,
                "n_weeks": int(r[6]) if r[6] else 0,
                "last_published": r[7].isoformat() if r[7] else None,
                "age_days": age_days,
                "status": status,
            })
        return status_list


def get_data_coverage(target_weeks: int = 156) -> Dict[str, Any]:
    """
    Returns week-by-week presence map for the latest N weeks.
    """
    with get_connection() as conn:
        if conn is None:
            return {"series": []}
        today = datetime.date.today()
        # Monday of current week
        current_monday = today - datetime.timedelta(days=today.weekday())
        start_monday = current_monday - datetime.timedelta(weeks=target_weeks)

        res = conn.execute(
            text("""
                SELECT series_id, week_start, is_imputed
                FROM weekly_prices
                WHERE week_start >= :start_date
                ORDER BY series_id, week_start ASC
            """),
            {"start_date": start_monday}
        )
        points_by_series: Dict[str, set] = {}
        for r in res.fetchall():
            sid = r[0]
            if sid not in points_by_series:
                points_by_series[sid] = set()
            points_by_series[sid].add(r[1].isoformat())

        all_weeks = []
        curr = start_monday
        while curr <= current_monday:
            all_weeks.append(curr.isoformat())
            curr += datetime.timedelta(weeks=1)

        result_series = []
        for sid, present_set in points_by_series.items():
            weeks_data = []
            for w in all_weeks:
                state = "ok" if w in present_set else "missing"
                weeks_data.append({"week_start": w, "state": state})
            result_series.append({
                "series_id": sid,
                "weeks": weeks_data
            })

        return {"series": result_series}
