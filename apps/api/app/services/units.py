"""
Unit conversion helpers.  All constants are spec-exact.
GT-UNIT-01: 5_000 INR/quintal → 50_000 INR/t
GT-UNIT-02: 1_000 US cents/bu → 367.437 USD/t
"""

# 1 tonne = 10 quintal
INR_PER_QUINTAL_TO_INR_PER_T: float = 10.0

# 1 bushel soybeans = 60 lb = 27.2155 kg → 1 tonne = 36.7437 bu
# USD/t = (cents/100) × 36.7437 = cents × 0.367437
CENTS_PER_BU_TO_USD_PER_T: float = 0.367437

# 1 t = 1_000 kg
KG_TO_T: float = 1 / 1_000


def inr_quintal_to_inr_t(price_inr_per_quintal: float) -> float:
    """INR per quintal → INR per tonne (×10)."""
    return price_inr_per_quintal * INR_PER_QUINTAL_TO_INR_PER_T


def cents_bu_to_usd_t(price_cents_per_bu: float) -> float:
    """US cents per bushel → USD per tonne.  GT-UNIT-02 passes when 1000 → 367.437."""
    return price_cents_per_bu * CENTS_PER_BU_TO_USD_PER_T


def kg_to_t(kg: float) -> float:
    return kg * KG_TO_T


def inr_per_kg_to_inr_per_t(price: float) -> float:
    return price * 1_000


def inr_per_quintal_or_kg_to_inr_per_t(price: float, unit: str) -> float:
    """Normalize a price to INR/t given its unit string."""
    if unit == "inr_per_t":
        return price
    if unit == "inr_per_quintal":
        return inr_quintal_to_inr_t(price)
    if unit == "inr_per_kg":
        return inr_per_kg_to_inr_per_t(price)
    raise ValueError(f"Unknown price unit: {unit!r}")


def quantity_to_t(qty: float, unit: str) -> float:
    """Normalize a quantity to tonnes given its unit string."""
    if unit == "t":
        return qty
    if unit == "kg":
        return kg_to_t(qty)
    if unit == "quintal":
        return qty / 10.0
    raise ValueError(f"Unknown quantity unit: {unit!r}")
