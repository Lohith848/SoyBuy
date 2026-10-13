"""
Cross-screen consistency test (Master Build Prompt §4 verification).

Two different screens both show the "route gap" (import vs domestic landed cost):
  - the dashboard recommendation  (GET /recommendation/latest)
  - the cost-comparison screen    (GET /landed-cost/compare)

They must return an IDENTICAL value, and that value must come from the single
backend function that computes it. This test fails if the two ever diverge.

Requires a live database; skipped when DATABASE_URL is absent/unreachable.
"""

from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv

load_dotenv()


def _db_available() -> bool:
    url = os.getenv("DATABASE_URL")
    if not url:
        return False
    try:
        import psycopg2

        conn = psycopg2.connect(url, connect_timeout=10)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_available(), reason="no database available")


def test_route_gap_identical_across_screens():
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services.data_store import store

    client = TestClient(app)

    lc_resp = client.get("/api/v1/landed-cost/compare")
    rec_resp = client.get("/api/v1/recommendation/latest")

    if lc_resp.status_code == 409 or rec_resp.status_code == 409:
        pytest.skip("calculation blocked (insufficient real data) — nothing to compare")

    assert lc_resp.status_code == 200, lc_resp.text
    assert rec_resp.status_code == 200, rec_resp.text

    gap_compare = lc_resp.json()[0]["route_gap_inr_per_t"]
    gap_dashboard = rec_resp.json()["route_gap_inr_per_t"]

    # 1) The same figure must be identical on both screens.
    assert gap_compare == gap_dashboard, (
        f"route gap differs across screens: compare={gap_compare} dashboard={gap_dashboard}"
    )

    # 2) And it must come from the single shared function.
    shared = store.compute_landed_costs()[0]["route_gap_inr_per_t"]
    assert gap_compare == shared, (
        f"landed-cost screen ({gap_compare}) does not match shared function ({shared})"
    )
    assert gap_dashboard == shared, (
        f"dashboard ({gap_dashboard}) does not match shared function ({shared})"
    )


def test_domestic_and_import_totals_share_one_source():
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services.data_store import store

    client = TestClient(app)
    lc_resp = client.get("/api/v1/landed-cost/compare")
    if lc_resp.status_code == 409:
        pytest.skip("calculation blocked (insufficient real data)")

    week0 = lc_resp.json()[0]
    shared = store.compute_landed_costs()[0]

    assert week0["domestic"]["total"] == shared["domestic"]["total"]
    assert week0["imported"]["total"] == shared["imported"]["total"]
    # Route gap sign convention: import - domestic.
    assert week0["route_gap_inr_per_t"] == round(
        week0["imported"]["total"] - week0["domestic"]["total"], 2
    )
