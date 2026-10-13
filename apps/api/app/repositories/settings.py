"""
Settings repository.
Loads, validates, and stores configuration versions in settings_versions table.
"""

from __future__ import annotations

import datetime
import json
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text
from app.db import get_connection
from app.schemas.models import SettingsModel

logger = logging.getLogger(__name__)

# Default field sources tagging per soy.md DR-3 / Appendix D
DEFAULT_FIELD_SOURCES = {
    "storage_capacity_t": "team_assumption",
    "safety_stock_t": "team_assumption",
    "weekly_consumption_t": "team_assumption",
    "dom_lot_size_t": "team_assumption",
    "dom_lead_time_days": "team_assumption",
    "dom_lead_time_weeks": "team_assumption",
    "mandi_tax_pct": "unverified_external",
    "commission_pct": "unverified_external",
    "inland_freight_inr_per_t": "team_assumption",
    "handling_unloading_inr_per_t": "team_assumption",
    "shrinkage_pct": "team_assumption",
    "import_enabled": "team_assumption",
    "imp_lot_size_t": "team_assumption",
    "imp_lead_time_days": "team_assumption",
    "imp_lead_time_weeks": "team_assumption",
    "ocean_freight_usd_per_t": "unverified_external",
    "marine_insurance_pct": "unverified_external",
    "landing_charge_pct": "unverified_external",
    "basic_customs_duty_pct": "unverified_external",
    "agriculture_infra_cess_pct": "unverified_external",
    "social_welfare_surcharge_pct": "unverified_external",
    "port_handling_inr_per_t": "team_assumption",
    "inland_transport_port_inr_per_t": "team_assumption",
    "financing_rate_annual_pct": "team_assumption",
    "price_risk_buffer_inr_per_t": "team_assumption",
    "holding_cost_inr_per_t_week": "team_assumption",
    "shortage_penalty_multiplier": "team_assumption",
    "risk_weight": "team_assumption",
}


def get_active_settings() -> Tuple[SettingsModel, Dict[str, str], str, int]:
    """
    Returns (settings_model, field_sources, version_id, version_no).
    If none exists in the DB, seeds version 1 automatically.
    """
    with get_connection() as conn:
        if conn is None:
            # Emergency offline fallback
            s = SettingsModel()
            return s, DEFAULT_FIELD_SOURCES, "offline-default", 1

        res = conn.execute(
            text("""
                SELECT id, version_no, params, field_sources
                FROM settings_versions
                WHERE is_active = true
                ORDER BY version_no DESC
                LIMIT 1
            """)
        )
        row = res.fetchone()

        if row:
            version_id = str(row[0])
            version_no = int(row[1])
            params_dict = row[2] if isinstance(row[2], dict) else json.loads(row[2])
            field_sources = row[3] if isinstance(row[3], dict) else json.loads(row[3] or "{}")
            # merge defaults if missing
            for k, v in DEFAULT_FIELD_SOURCES.items():
                if k not in field_sources:
                    field_sources[k] = v
            model = SettingsModel(**params_dict)
            model.version_id = version_id
            return model, field_sources, version_id, version_no

        # Seed initial version 1 if table is empty
        initial_model = SettingsModel()
        new_id = str(uuid.uuid4())
        initial_params = initial_model.model_dump(mode="json")
        initial_params["version_id"] = new_id

        res = conn.execute(
            text("""
                INSERT INTO settings_versions (id, schema_version, params, field_sources, is_active, note)
                VALUES (:id, 1, :params, :field_sources, true, 'Initial operational baseline (seed)')
                RETURNING version_no
            """),
            {
                "id": new_id,
                "params": json.dumps(initial_params),
                "field_sources": json.dumps(DEFAULT_FIELD_SOURCES),
            }
        )
        v_no = int(res.fetchone()[0])
        logger.info("Seeded initial settings_versions row id=%s v=%d", new_id, v_no)
        return initial_model, DEFAULT_FIELD_SOURCES, new_id, v_no


def save_settings(
    settings: SettingsModel,
    field_sources: Optional[Dict[str, str]] = None,
    note: Optional[str] = None,
    created_by: Optional[str] = None,
) -> Tuple[str, int]:
    """
    Saves a new active version to settings_versions and deactivates earlier versions.
    Returns (new_version_id, new_version_no).
    """
    with get_connection() as conn:
        if conn is None:
            raise RuntimeError("Database unavailable")

        new_id = str(uuid.uuid4())
        params_dict = settings.model_dump(mode="json")
        params_dict["version_id"] = new_id

        sources = dict(DEFAULT_FIELD_SOURCES)
        if field_sources:
            sources.update(field_sources)

        # Deactivate old versions
        conn.execute(text("UPDATE settings_versions SET is_active = false WHERE is_active = true"))

        # Insert new version letting DB generate version_no
        res = conn.execute(
            text("""
                INSERT INTO settings_versions
                  (id, schema_version, params, field_sources, is_active, note, created_by)
                VALUES
                  (:id, 1, :params, :field_sources, true, :note, :created_by)
                RETURNING version_no
            """),
            {
                "id": new_id,
                "params": json.dumps(params_dict),
                "field_sources": json.dumps(sources),
                "note": note or "Updated settings",
                "created_by": created_by,
            }
        )
        new_version_no = int(res.fetchone()[0])
        return new_id, new_version_no


def list_settings_versions(limit: int = 20) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if conn is None:
            return []
        res = conn.execute(
            text("""
                SELECT id, version_no, is_active, note, created_at
                FROM settings_versions
                ORDER BY version_no DESC
                LIMIT :limit
            """),
            {"limit": limit}
        )
        return [
            {
                "id": str(r[0]),
                "version_no": r[1],
                "is_active": r[2],
                "note": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
            }
            for r in res.fetchall()
        ]
