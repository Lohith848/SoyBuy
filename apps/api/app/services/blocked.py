"""
BlockedCalculation — raised when a calculation cannot honestly run because real
inputs are missing (insufficient history, missing settings, no real data yet).

The API converts this into a structured error (Master Spec E.1) whose `blockers`
list drives the frontend's empty/blocked states. It is never a fake fallback.
"""

from __future__ import annotations

from typing import List


class BlockedCalculation(Exception):
    def __init__(self, code: str, message: str, blockers: List[str] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.blockers = blockers or []
