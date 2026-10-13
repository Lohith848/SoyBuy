"""
Compute weekly prices from daily price observations.
Master Spec C.3.3 and C.3.6.
Weekly aggregation uses Monday-start weeks and median across daily observations.
"""

from __future__ import annotations

import datetime
import logging
from typing import Optional
from sqlalchemy import text
from app.db import get_connection

logger = logging.getLogger(__name__)


def compute_weekly_prices(series_id: Optional[str] = None) -> int:
    """
    Aggregates price_observations into weekly_prices for Monday-start weeks.
    Returns number of weekly rows upserted.
    """
    with get_connection() as conn:
        if conn is None:
            logger.error("No database connection available")
            return 0

        where_clause = "WHERE is_excluded = false"
        params = {}
        if series_id:
            where_clause += " AND series_id = :series_id"
            params["series_id"] = series_id

        sql = f"""
        WITH weekly_agg AS (
            SELECT
                series_id,
                date_trunc('week', obs_date)::date AS week_start,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS med_value,
                count(*) AS obs_count,
                max(published_at) AS max_known_at
            FROM price_observations
            {where_clause}
            GROUP BY series_id, date_trunc('week', obs_date)::date
        )
        INSERT INTO weekly_prices (series_id, week_start, value, n_obs, is_imputed, known_at, computed_at)
        SELECT
            series_id,
            week_start,
            round(med_value::numeric, 2),
            obs_count,
            false,
            max_known_at,
            now()
        FROM weekly_agg
        ON CONFLICT (series_id, week_start) DO UPDATE SET
            value = EXCLUDED.value,
            n_obs = EXCLUDED.n_obs,
            is_imputed = EXCLUDED.is_imputed,
            known_at = EXCLUDED.known_at,
            computed_at = now();
        """
        result = conn.execute(text(sql), params)
        rows_affected = result.rowcount
        logger.info("Computed %d weekly_prices rows for series=%s", rows_affected, series_id or "all")
        return rows_affected


if __name__ == "__main__":
    import sys
    sid = sys.argv[1] if len(sys.argv) > 1 else None
    count = compute_weekly_prices(sid)
    print(f"Weekly aggregation completed: {count} rows updated.")
