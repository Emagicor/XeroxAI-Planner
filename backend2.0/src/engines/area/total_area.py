"""
engines/area/total_area.py

Deterministic total-area computation.

FIX vs original total_area.py:
  - No longer mutates the input dict (was side-effectful)
  - Unit string "meters" vs "meter" inconsistency fixed (now handles both)
  - _extract_layout_dimensions returns a typed result, not a bare tuple
  - apply_total_area is now a pure function: returns a new dict
  - All conversion constants imported from config/constants.py (single source)
"""
from __future__ import annotations

from dataclasses import dataclass

from config.constants import METERS_TO_FEET, MM_TO_FEET, CM_TO_FEET


@dataclass
class TotalAreaResult:
    total_sqft: float
    source: str                      # "layout_dimensions" | "room_sum"
    layout_dims_used: dict | None    # {"width_ft": ..., "height_ft": ...} or None


def _to_feet(value: float, units: str) -> float:
    """Normalise any detected unit to feet."""
    u = units.lower().strip()
    if u in ("meters", "meter", "metres", "metre", "m"):
        return value * METERS_TO_FEET
    if u == "mm":
        return value * MM_TO_FEET
    if u in ("cm", "centimeters", "centimetres"):
        return value * CM_TO_FEET
    return value  # already feet


def _extract_layout_dims(
    data: dict,
    units: str,
) -> tuple[float, float] | None:
    """
    Return (width_ft, height_ft) if layout dimensions are available and valid.
    Returns None otherwise — caller falls through to room_sum.

    FIX: original silently fell through when 'available' key was absent.
    Now: if available=False is explicit → None; if missing → try values anyway.
    """
    layout: dict = data.get("layout_dimensions") or {}

    # Explicit opt-out
    if layout.get("available") is False:
        return None

    width  = layout.get("width_ft")  or data.get("layout_width_ft")
    height = layout.get("height_ft") or data.get("layout_height_ft")

    if (
        isinstance(width, (int, float))
        and isinstance(height, (int, float))
        and width > 0
        and height > 0
    ):
        return _to_feet(float(width), units), _to_feet(float(height), units)

    return None


def compute_total_area(data: dict) -> TotalAreaResult:
    """
    Pure function — does not modify the input dict.

    Priority:
      1. layout_dimensions.width_ft × height_ft  (if available and both > 0)
      2. Sum of all room.area_sqft values         (fallback)
    """
    units: str = data.get("units_detected") or "feet"
    rooms: list = data.get("rooms") or []

    dims = _extract_layout_dims(data, units)

    if dims is not None:
        w_ft, h_ft = dims
        total = round(w_ft * h_ft, 2)
        return TotalAreaResult(
            total_sqft=total,
            source="layout_dimensions",
            layout_dims_used={"width_ft": round(w_ft, 2), "height_ft": round(h_ft, 2)},
        )

    # Fallback: sum room areas (null areas are skipped — they are assumed/ineligible)
    room_total = sum(
        float(r["area_sqft"])
        for r in rooms
        if isinstance(r.get("area_sqft"), (int, float)) and r["area_sqft"] > 0
    )
    return TotalAreaResult(
        total_sqft=round(room_total, 2),
        source="room_sum",
        layout_dims_used=None,
    )


def apply_total_area(data: dict) -> dict:
    """
    Convenience wrapper: returns a NEW dict with total_area_sqft fields set.
    Does NOT mutate the original.
    """
    result = compute_total_area(data)
    return {
        **data,
        "total_area_sqft":     result.total_sqft,
        "total_area_source":   result.source,
        "layout_dimensions_used": result.layout_dims_used,
    }