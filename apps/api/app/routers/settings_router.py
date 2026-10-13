"""
Settings API. Spec E.2  GET /settings, PUT /settings, GET /settings/versions.

Backed by the versioned settings_versions table. PUT creates a new active
version via the repository (previously this mutated an in-memory object and
raised because the store attribute is read-only).

Auth: the API connects as the soybuy_api role; recorded_by is left null until
auth is wired, so the version note states the origin.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter

from app.schemas.models import SettingsModel
from app.repositories.settings import (
    get_active_settings,
    save_settings,
    list_settings_versions,
)

router = APIRouter()


@router.get("/settings", response_model=SettingsModel)
async def read_settings():
    model, _sources, _vid, _vno = get_active_settings()
    return model


@router.put("/settings", response_model=SettingsModel)
async def update_settings(payload: SettingsModel):
    save_settings(payload, note="Updated via API (no auth session yet)")
    model, _sources, _vid, _vno = get_active_settings()
    return model


@router.get("/settings/versions")
async def read_settings_versions() -> List[Dict[str, Any]]:
    return list_settings_versions()
