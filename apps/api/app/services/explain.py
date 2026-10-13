"""
Explanation engine.  Spec C.9.
Pure function: facts in → headline + reasons + confidence.
No language model.  Every sentence traces to a stored fact.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

EXPLAIN_VERSION = "1"


# ---------------------------------------------------------------------------
# Facts (C.9.1)
# ---------------------------------------------------------------------------

@dataclass
class ExplainFacts:
    # Forecast change facts
    dom_change_4w: float = 0.0           # (p50_h4 / last_actual) - 1
    dom_change_4w_lo: float = 0.0
    dom_change_4w_hi: float = 0.0
    dom_change_8w: float = 0.0
    band_rel_4w: float = 0.0             # (p90-p10)/p50 at h=4
    # Route comparison
    route_gap: float = 0.0               # import_total_p50[0] - domestic_total_p50[0] INR/t
    cheaper_route: str = "domestic"
    abs_gap: float = 0.0
    # Stock and lead
    cover_days: float = 0.0
    lead_days_dom: int = 0
    lead_days_imp: int = 0
    # Plan facts
    shortage_weeks: list[int] = None  # type: ignore[assignment]
    shortage_max_t: float = 0.0
    week0_tonnes: float = 0.0
    cover_pct_4w: float = 0.0           # week0_tonnes / sum(D[0..3]), rounded to 5%
    route_breakdown: str = ""           # e.g. "domestic"
    # Seasonal drift (if available)
    seasonal_drift: Optional[float] = None
    seasonal_target_week: str = ""
    # Constraints
    binding_capacity_weeks: list[int] = None   # type: ignore[assignment]
    binding_minorder_weeks: list[int] = None   # type: ignore[assignment]
    # Metadata
    import_enabled: bool = False
    review_date: str = ""

    def __post_init__(self):
        if self.shortage_weeks is None:
            self.shortage_weeks = []
        if self.binding_capacity_weeks is None:
            self.binding_capacity_weeks = []
        if self.binding_minorder_weeks is None:
            self.binding_minorder_weeks = []


# ---------------------------------------------------------------------------
# Confidence label (C.9.4)
# ---------------------------------------------------------------------------

def confidence_label(
    facts: ExplainFacts,
    has_data_warning: bool = False,
    manual_view_applied: bool = False,
) -> str:
    if (
        facts.band_rel_4w > 0.15
        or has_data_warning
        or manual_view_applied
    ):
        return "low"
    if 0.08 <= facts.band_rel_4w <= 0.15:
        return "medium"
    return "high"


# ---------------------------------------------------------------------------
# Headline templates (C.9.2)
# ---------------------------------------------------------------------------

def _fmt_pct(v: float) -> str:
    return f"{v * 100:.0f}%"


def _route_sentence(facts: ExplainFacts) -> str:
    if not facts.import_enabled:
        return "Import is switched off in settings."
    direction = "costlier" if facts.route_gap > 0 else "cheaper"
    return (
        f"Import is about INR {abs(facts.abs_gap):,.0f}/t {direction} than domestic "
        f"at current settings."
    )


def headline(facts: ExplainFacts, confidence: str) -> str:
    pct = _fmt_pct(round(facts.cover_pct_4w * 20) / 20)  # round to 5%
    route_s = _route_sentence(facts)

    if facts.shortage_weeks:
        short_weeks = ", ".join(str(w) for w in facts.shortage_weeks)
        warning = (
            f"Warning: safety stock cannot be kept in week(s) {short_weeks} "
            f"because of lead times (shortfall up to {facts.shortage_max_t:.0f} t). "
            f"Place the order below now and consider urgent sourcing. "
        )
    else:
        warning = ""

    if facts.week0_tonnes > 0:
        text = (
            f"Order {facts.week0_tonnes:.0f} t this week "
            f"({facts.route_breakdown}), about {pct} of the next 4 weeks' need. "
            f"{route_s} Review again on {facts.review_date}."
        )
    else:
        text = (
            f"No purchase needed this week. "
            f"Stock covers about {facts.cover_days:.0f} days. "
            f"{route_s} Review on {facts.review_date}."
        )

    return warning + text


# ---------------------------------------------------------------------------
# Reason candidates (C.9.3)
# ---------------------------------------------------------------------------

def _reasons(facts: ExplainFacts) -> list[dict]:
    candidates = []

    # R-SHORT
    if facts.shortage_weeks:
        short_weeks = ", ".join(str(w) for w in facts.shortage_weeks)
        candidates.append({
            "id": "R-SHORT",
            "score": 10.0,
            "text": (
                f"Safety stock would be breached in week(s) {short_weeks} "
                f"(up to {facts.shortage_max_t:.0f} t short)."
            ),
            "fact_refs": ["shortage_weeks", "shortage_max_t"],
        })

    # R-PRICE
    score_price = abs(facts.dom_change_4w) / 0.05 if facts.dom_change_4w else 0
    candidates.append({
        "id": "R-PRICE",
        "score": score_price,
        "text": (
            f"Likely domestic price change over 4 weeks: "
            f"{facts.dom_change_4w:+.1%} "
            f"(range {facts.dom_change_4w_lo:+.1%} to {facts.dom_change_4w_hi:+.1%})."
        ),
        "fact_refs": ["dom_change_4w"],
    })

    # R-ROUTE
    if facts.import_enabled:
        dom_total_proxy = max(facts.abs_gap, 1.0)
        score_route = (abs(facts.route_gap) / dom_total_proxy) / 0.03
        route_text = (
            f"{facts.cheaper_route.capitalize()} is cheaper by "
            f"INR {facts.abs_gap:,.0f}/t at current settings."
        )
        candidates.append({
            "id": "R-ROUTE",
            "score": score_route,
            "text": route_text,
            "fact_refs": ["route_gap", "cheaper_route"],
        })

    # R-COVER
    max_lead = max(facts.lead_days_dom, facts.lead_days_imp) if facts.import_enabled else facts.lead_days_dom
    score_cover = 2.0 if facts.cover_days <= 1.5 * max_lead else 0.5
    candidates.append({
        "id": "R-COVER",
        "score": score_cover,
        "text": (
            f"Stock covers {facts.cover_days:.0f} days; "
            f"lead time is {facts.lead_days_dom} days (domestic)."
        ),
        "fact_refs": ["cover_days", "lead_days_dom"],
    })

    # R-UNCERT
    score_uncert = facts.band_rel_4w / 0.10
    label = "high" if facts.band_rel_4w > 0.15 else ("medium" if facts.band_rel_4w > 0.08 else "low")
    candidates.append({
        "id": "R-UNCERT",
        "score": score_uncert,
        "text": (
            f"Forecast uncertainty is {label} "
            f"(4-week band {facts.band_rel_4w:.0%} of the likely price)."
        ),
        "fact_refs": ["band_rel_4w"],
    })

    # R-SEAS
    if facts.seasonal_drift is not None:
        score_seas = abs(facts.seasonal_drift) / 0.05
        direction = "rise" if facts.seasonal_drift > 0 else "fall"
        candidates.append({
            "id": "R-SEAS",
            "score": score_seas,
            "text": (
                f"At this time of year prices tend to {direction} about "
                f"{abs(facts.seasonal_drift):.0%} by {facts.seasonal_target_week}."
            ),
            "fact_refs": ["seasonal_drift"],
        })

    # R-CONSTR
    if facts.binding_capacity_weeks or facts.binding_minorder_weeks:
        weeks_str = ", ".join(str(w) for w in (facts.binding_capacity_weeks or facts.binding_minorder_weeks))
        constr = "Storage capacity" if facts.binding_capacity_weeks else "Minimum order size"
        candidates.append({
            "id": "R-CONSTR",
            "score": 1.5,
            "text": f"{constr} limits the plan in week(s) {weeks_str}.",
            "fact_refs": ["binding"],
        })

    # Sort: R-SHORT always first, then by score descending
    short_items = [c for c in candidates if c["id"] == "R-SHORT"]
    rest = sorted([c for c in candidates if c["id"] != "R-SHORT"],
                  key=lambda x: (-x["score"],))

    top = (short_items + rest)[:3]
    # Ensure at least 2
    if len(top) == 1 and len(candidates) > 1:
        top = (short_items + rest)[:2]
    return top


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def explain(
    facts: ExplainFacts,
    has_data_warning: bool = False,
    manual_view_applied: bool = False,
) -> dict:
    """
    Returns {headline, reasons, confidence, explain_version, facts_snapshot}.
    """
    conf = confidence_label(facts, has_data_warning, manual_view_applied)
    hl = headline(facts, conf)
    reasons = _reasons(facts)

    return {
        "headline": hl,
        "reasons": reasons,
        "confidence": conf,
        "explain_version": EXPLAIN_VERSION,
        "facts_snapshot": {
            "dom_change_4w": facts.dom_change_4w,
            "dom_change_4w_lo": facts.dom_change_4w_lo,
            "dom_change_4w_hi": facts.dom_change_4w_hi,
            "band_rel_4w": facts.band_rel_4w,
            "route_gap": facts.route_gap,
            "cheaper_route": facts.cheaper_route,
            "cover_days": facts.cover_days,
            "shortage_weeks": facts.shortage_weeks,
            "shortage_max_t": facts.shortage_max_t,
            "week0_tonnes": facts.week0_tonnes,
            "cover_pct_4w": facts.cover_pct_4w,
            "seasonal_drift": facts.seasonal_drift,
        },
    }
