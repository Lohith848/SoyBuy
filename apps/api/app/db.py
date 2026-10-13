"""
Database connectivity helper.
Uses DATABASE_URL env variable (Supabase Postgres).
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Generator, Optional, Tuple

logger = logging.getLogger(__name__)

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            logger.warning("DATABASE_URL not set; database features unavailable")
            return None
        try:
            from sqlalchemy import create_engine
            _engine = create_engine(db_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
            logger.info("Database engine created")
        except Exception as e:
            logger.error("Failed to create DB engine: %s", e)
            return None
    return _engine


@contextmanager
def get_connection() -> Generator:
    engine = get_engine()
    if engine is None:
        yield None
        return
    conn = engine.connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def check_db_ready() -> Tuple[bool, Optional[str]]:
    """Returns (is_ready, schema_version_string)."""
    engine = get_engine()
    if engine is None:
        return False, None
    try:
        with engine.connect() as conn:
            from sqlalchemy import text
            conn.execute(text("SELECT 1"))
            # Try to get a schema version marker
            try:
                result = conn.execute(
                    text("SELECT MAX(version_no) FROM settings_versions LIMIT 1")
                )
                row = result.fetchone()
                version = str(row[0]) if row and row[0] is not None else "0"
            except Exception:
                version = "schema-pending"
        return True, version
    except Exception as e:
        logger.error("DB readiness check failed: %s", e)
        return False, None
