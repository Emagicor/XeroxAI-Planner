"""
Deterministic cleanup of vision model room data — never trust model arithmetic.
"""
from __future__ import annotations

from engines.dimensions.parse import parse_dimension_to_feet


def sanitize_vision_rooms(data: dict) -> dict:
    """Normalize dimensions and recompute area from length × width."""
    rooms_out = []
    for room in data.get("rooms") or []:
        r = dict(room)
        length = parse_dimension_to_feet(r.get("length_ft"))
        width = parse_dimension_to_feet(r.get("width_ft"))
        area = parse_dimension_to_feet(r.get("area_sqft"))

        if length is not None:
            r["length_ft"] = round(length, 2)
        else:
            r["length_ft"] = None

        if width is not None:
            r["width_ft"] = round(width, 2)
        else:
            r["width_ft"] = None

        if r["length_ft"] and r["width_ft"]:
            r["area_sqft"] = round(float(r["length_ft"]) * float(r["width_ft"]), 2)
        elif area is not None:
            r["area_sqft"] = round(area, 2)
        else:
            r["area_sqft"] = None

        rooms_out.append(r)

    return {**data, "rooms": rooms_out}
