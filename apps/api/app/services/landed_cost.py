"""
Landed-cost pure functions.  Spec C.6.
All inputs are prices and a settings dict/object.
No I/O, no database.  100% testable.

GT-LC-01  domestic: total = 53_700.00
GT-LC-02  import:   total = 50_023.73  (tolerance 0.01)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DomesticSettings:
    dom_market_fee_pct: float = 0.0
    dom_commission_pct: float = 0.0
    dom_transport_flat_inr_per_t: Optional[float] = None
    dom_transport_inr_per_t_km: Optional[float] = None
    dom_distance_km: Optional[float] = None
    dom_handling_inr_per_t: float = 0.0
    dom_quality_allowance_pct: float = 0.0
    dom_other_taxes_pct: float = 0.0
    finance_rate_annual: float = 0.0
    dom_prepay_days: float = 0.0


@dataclass(frozen=True)
class ImportSettings:
    fob_premium_usd_per_t: float = 0.0
    imp_freight_usd_per_t: float = 0.0
    imp_insurance_pct: float = 0.0
    imp_landing_pct: float = 0.0
    imp_duty_effective_pct: float = 0.0
    imp_port_clearing_inr_per_t: float = 0.0
    imp_inland_transport_inr_per_t: float = 0.0
    imp_handling_inr_per_t: float = 0.0
    imp_quality_allowance_pct: float = 0.0
    imp_risk_buffer_pct: float = 0.0
    finance_rate_annual: float = 0.0
    imp_prepay_days: float = 0.0


# ---------------------------------------------------------------------------
# C.6.1  Domestic landed cost
# ---------------------------------------------------------------------------

def domestic_landed_cost(price_inr_per_t: float, s: DomesticSettings) -> dict:
    """
    Returns a dict with each component and 'total'.
    Components sum to total exactly (no rounding inside).
    """
    P = price_inr_per_t
    market_fee = P * s.dom_market_fee_pct
    commission = P * s.dom_commission_pct

    if s.dom_transport_flat_inr_per_t is not None:
        transport = s.dom_transport_flat_inr_per_t
    elif s.dom_transport_inr_per_t_km is not None and s.dom_distance_km is not None:
        transport = s.dom_transport_inr_per_t_km * s.dom_distance_km
    else:
        transport = 0.0

    handling = s.dom_handling_inr_per_t
    quality_allowance = P * s.dom_quality_allowance_pct
    other_taxes = P * s.dom_other_taxes_pct
    financing = (P + market_fee + commission + other_taxes) * s.finance_rate_annual * s.dom_prepay_days / 365.0

    components = {
        "base_price": P,
        "market_fee": market_fee,
        "commission": commission,
        "transport": transport,
        "handling": handling,
        "quality_allowance": quality_allowance,
        "other_taxes": other_taxes,
        "financing": financing,
    }
    components["total"] = sum(components.values())
    return components


# ---------------------------------------------------------------------------
# C.6.2  Import landed cost
# ---------------------------------------------------------------------------

def import_landed_cost(int_usd_per_t: float, fx_inr_per_usd: float, s: ImportSettings) -> dict:
    """
    Returns a dict with each component and 'total'.
    Components (except intermediate steps) sum to total exactly.
    """
    fob_usd = int_usd_per_t + s.fob_premium_usd_per_t
    insurance_usd = (fob_usd + s.imp_freight_usd_per_t) * s.imp_insurance_pct
    cif_usd = fob_usd + s.imp_freight_usd_per_t + insurance_usd
    cif_inr = cif_usd * fx_inr_per_usd
    assessable_inr = cif_inr * (1.0 + s.imp_landing_pct)
    duty_inr = assessable_inr * s.imp_duty_effective_pct

    port_clearing = s.imp_port_clearing_inr_per_t
    inland_transport = s.imp_inland_transport_inr_per_t
    handling = s.imp_handling_inr_per_t
    quality_allowance = cif_inr * s.imp_quality_allowance_pct
    financing = cif_inr * s.finance_rate_annual * s.imp_prepay_days / 365.0
    risk_buffer = cif_inr * s.imp_risk_buffer_pct

    components = {
        "cif_inr": cif_inr,
        "duty": duty_inr,
        "port_clearing": port_clearing,
        "inland_transport": inland_transport,
        "handling": handling,
        "quality_allowance": quality_allowance,
        "financing": financing,
        "risk_buffer": risk_buffer,
    }
    components["total"] = sum(components.values())

    # Store intermediate values for transparency (not summed twice)
    components["_fob_usd"] = fob_usd
    components["_cif_usd"] = cif_usd
    components["_assessable_inr"] = assessable_inr
    return components


# ---------------------------------------------------------------------------
# C.6.3  FX projection (for plan week t at horizon h)
# ---------------------------------------------------------------------------

def projected_fx(
    fx_spot: float,
    fx_drift_annual: float,
    horizon_weeks: int,
    fx_shock: float = 0.0,
) -> float:
    """FX rate projected to horizon h (1-indexed)."""
    return fx_spot * (1.0 + fx_drift_annual * horizon_weeks / 52.0) * (1.0 + fx_shock)
