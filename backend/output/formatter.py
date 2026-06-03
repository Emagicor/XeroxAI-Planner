"""
output/formatter.py
-------------------
Converts the internal multi-page analysis result into the flat row format
required by the spec:

  Page/Floor | Area name | Dimensions | Computed area | Method | Confidence | Assumed? | Notes

Also provides unit-conversion helpers so the frontend can recompute
client-side without re-running the model (sqft → sqm / sq-in / sq-cm).
"""

from __future__ import annotations

from typing import Any

# ── conversion factors from sqft ─────────────────────────────────────────────
UNIT_FACTORS: dict[str, float] = {
    "sqft": 1.0,
    "sqm": 0.092903,
    "sq-in": 144.0,
    "sq-cm": 929.03,
}

UNIT_LABELS: dict[str, str] = {
    "sqft": "sq ft",
    "sqm": "sq m",
    "sq-in": "sq in",
    "sq-cm": "sq cm",
}


def _method_label(source: str | None) -> str:
    mapping = {
        "measured": "Label",
        "derived": "Scale/Inferred",
        "assumed": "Inferred",
    }
    return mapping.get(source or "", "Unknown")


def _dimensions_str(room: dict) -> str:
    l = room.get("length_ft")
    w = room.get("width_ft")
    if l and w:
        return f"{l:.1f}' × {w:.1f}'"
    return "—"


def _is_assumed(room: dict) -> bool:
    src = room.get("dimension_source", "")
    assumptions = room.get("assumptions", [])
    return src == "assumed" or bool(assumptions)


def _convert_area(area_sqft: float | None, unit: str) -> float | None:
    if area_sqft is None:
        return None
    factor = UNIT_FACTORS.get(unit, 1.0)
    return round(area_sqft * factor, 2)


# ── public API ────────────────────────────────────────────────────────────────

def build_table_rows(
    analysis_result: dict,
    unit: str = "sqft",
) -> list[dict[str, Any]]:
    """
    Flatten multi-page analysis result into table rows.

    Each row::

        {
          "page": int,
          "floor": str,            # "Page 1", "Page 2", …
          "area_name": str,
          "dimensions": str,       # "14.0' × 12.0'" or "—"
          "computed_area": float | None,
          "unit": str,             # current display unit
          "method": str,           # Label | Scale/Inferred | Inferred
          "confidence_pct": int,
          "assumed": bool,
          "notes": str,
          "eligible": bool,        # False → ineligible page row
          "ineligible_reason": str | None,
        }
    """
    rows: list[dict] = []
    pages: list[dict] = analysis_result.get("pages", [])

    for page_data in pages:
        page_num: int = page_data.get("page", 0)
        floor_label = f"Page {page_num}"
        eligible: bool = page_data.get("eligible", True)

        if not eligible:
            rows.append(
                {
                    "page": page_num,
                    "floor": floor_label,
                    "area_name": "—",
                    "dimensions": "—",
                    "computed_area": None,
                    "unit": unit,
                    "method": "—",
                    "confidence_pct": 0,
                    "assumed": False,
                    "notes": page_data.get("reason", "Ineligible page"),
                    "eligible": False,
                    "ineligible_reason": page_data.get("reason", ""),
                }
            )
            continue

        rooms: list[dict] = page_data.get("rooms", [])
        for room in rooms:
            area_sqft = room.get("area_sqft")
            assumed = _is_assumed(room)
            assumptions_text = "; ".join(room.get("assumptions") or [])

            rows.append(
                {
                    "page": page_num,
                    "floor": floor_label,
                    "area_name": room.get("name", "Unknown"),
                    "dimensions": _dimensions_str(room),
                    "computed_area": _convert_area(area_sqft, unit),
                    "unit": unit,
                    "method": _method_label(room.get("dimension_source")),
                    "confidence_pct": room.get("confidence_pct", 0),
                    "assumed": assumed,
                    "notes": assumptions_text,
                    "eligible": True,
                    "ineligible_reason": None,
                }
            )

    return rows


def convert_rows_unit(rows: list[dict], new_unit: str) -> list[dict]:
    """
    Re-express all computed_area values in a new unit.
    Performed client-side equivalent — pure math, no model call.
    """
    label = UNIT_LABELS.get(new_unit, new_unit)
    updated: list[dict] = []
    for row in rows:
        r = dict(row)
        # Original area is stored as sqft; convert
        # We store the sqft source so we can always reconvert correctly.
        if r.get("eligible") and r.get("computed_area") is not None:
            original_sqft = r.get("_area_sqft")  # stashed below
            if original_sqft is not None:
                r["computed_area"] = _convert_area(original_sqft, new_unit)
        r["unit"] = label
        updated.append(r)
    return updated


def build_summary(analysis_result: dict, unit: str = "sqft") -> dict:
    """
    Return a summary block for the document.
    """
    factor = UNIT_FACTORS.get(unit, 1.0)
    label = UNIT_LABELS.get(unit, unit)
    grand_sqft = analysis_result.get("grand_total_sqft", 0.0)
    return {
        "page_count": analysis_result.get("page_count", 0),
        "eligible_pages": analysis_result.get("eligible_pages", 0),
        "ineligible_pages": analysis_result.get("ineligible_pages", 0),
        "grand_total": round(grand_sqft * factor, 2),
        "unit": label,
        "grand_total_sqft": grand_sqft,
    }