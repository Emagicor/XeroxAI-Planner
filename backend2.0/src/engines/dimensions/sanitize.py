"""
Deterministic cleanup of vision model room data — never trust model arithmetic.

Room inclusion rules (enforced here):
  1. Dimensions without a plan label → keep; generic name replaced if needed.
  2. Plan label without dimensions or area → drop room entirely.
  3. Area-only annotation → keep area; compute area from L×W when both present.
"""
from __future__ import annotations

from engines.dimensions.parse import parse_dimension_to_feet

_GENERIC_NAMES = frozenset({
    "",
    "room",
    "unnamed",
    "(unnamed)",
    "unknown",
    "unknown room",
    "inferred room",
    "unlabeled space",
    "space",
})


def _is_plan_label(name: object) -> bool:
    text = str(name or "").strip()
    if not text:
        return False
    return text.lower() not in _GENERIC_NAMES


def _coerce_confidence(value: object) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 50


def _has_dimensions(length: float | None, width: float | None) -> bool:
    return (
        length is not None
        and width is not None
        and length > 0
        and width > 0
    )


def sanitize_vision_rooms(data: dict) -> dict:
    """Normalize dimensions, apply inclusion rules, recompute area from length × width."""
    rooms_out = []
    for room in data.get("rooms") or []:
        r = dict(room)
        length = parse_dimension_to_feet(r.get("length_ft"))
        width = parse_dimension_to_feet(r.get("width_ft"))
        area = parse_dimension_to_feet(r.get("area_sqft"))

        has_dims = _has_dimensions(length, width)
        has_area = area is not None and area > 0
        has_label = _is_plan_label(r.get("name"))

        # Rule 2: label on plan but no measurable data → ignore room
        if has_label and not has_dims and not has_area:
            continue

        # Nothing measurable left → skip
        if not has_dims and not has_area:
            continue

        r["confidence_pct"] = _coerce_confidence(r.get("confidence_pct"))

        # Rule 1: dimensions without a plan label → keep with a descriptive fallback name
        if has_dims and not has_label:
            r["name"] = "Inferred Room"

        # Rule 3: area-only vs dimensions
        if has_dims:
            r["length_ft"] = round(length, 2)
            r["width_ft"] = round(width, 2)
            r["area_sqft"] = round(float(r["length_ft"]) * float(r["width_ft"]), 2)
            source = str(r.get("dimension_source") or "").lower()
            if source not in ("measured", "derived"):
                r["dimension_source"] = "measured"
        else:
            r["length_ft"] = None
            r["width_ft"] = None
            r["area_sqft"] = round(area, 2)
            r["dimension_source"] = "measured"

        rooms_out.append(r)

    return {**data, "rooms": rooms_out}
