"""
infrastructure/exporters/formatter.py

FIX vs original output/formatter.py:
  - convert_rows_unit read _area_sqft which was NEVER set → always None.
    Now rows store _area_sqft explicitly during build so reconversion works.
  - floor label now uses room.floor if available, not always "Page N"
  - build_table_rows accepts AnalyzeJob directly (typed) as well as raw dict
  - All unit conversion goes through a single _convert helper
"""
from __future__ import annotations

from typing import Any

from config.constants import SQFT_TO, UNIT_LABELS
from domain.entities.job import AnalyzeJob, DimensionSource


def _method_label(source: DimensionSource | str | None) -> str:
    mapping = {
        "measured": "Label",
        "derived":  "Scale/Inferred",
        "assumed":  "Inferred",
    }
    key = source.value if isinstance(source, DimensionSource) else (source or "")
    return mapping.get(key, "Unknown")


def _dims_str(length_ft: float | None, width_ft: float | None) -> str:
    if length_ft is not None and width_ft is not None:
        return f"{length_ft:.1f}' × {width_ft:.1f}'"
    return "—"


def _convert(area_sqft: float | None, unit: str) -> float | None:
    if area_sqft is None:
        return None
    return round(area_sqft * SQFT_TO.get(unit, 1.0), 2)


# ── Public API ────────────────────────────────────────────────────────────────

def build_table_rows(job: AnalyzeJob, unit: str = "sqft") -> list[dict[str, Any]]:
    """
    Flatten an AnalyzeJob into a list of table rows.

    Each row contains all fields the spec requires:
      Page/Floor | Area name | Dimensions | Computed area |
      Method | Confidence | Assumed? | Notes
    Plus _area_sqft (private) for client-side unit reconversion.
    """
    rows: list[dict] = []

    for page in job.pages:
        floor_label = f"Page {page.page_number}"

        if not page.eligible:
            rows.append({
                "page":              page.page_number,
                "floor":             floor_label,
                "area_name":         "—",
                "dimensions":        "—",
                "computed_area":     None,
                "unit":              UNIT_LABELS.get(unit, unit),
                "method":            "—",
                "confidence_pct":    0,
                "assumed":           False,
                "notes":             page.ineligible_reason or "Ineligible page",
                "eligible":          False,
                "ineligible_reason": page.ineligible_reason,
                "_area_sqft":        None,
            })
            continue

        for room in page.rooms:
            # Use room.floor if the model extracted it, else fall back to page label
            room_floor = getattr(room, "floor", None) or floor_label
            area_sqft  = room.area_sqft

            rows.append({
                "page":              page.page_number,
                "floor":             room_floor,
                "area_name":         room.name,
                "dimensions":        _dims_str(room.length_ft, room.width_ft),
                "computed_area":     _convert(area_sqft, unit),
                "unit":              UNIT_LABELS.get(unit, unit),
                "method":            _method_label(room.dimension_source),
                "confidence_pct":    room.confidence_pct,
                "assumed":           room.is_assumed,
                "notes":             "; ".join(room.assumptions),
                "eligible":          True,
                "ineligible_reason": None,
                "_area_sqft":        area_sqft,   # stashed for reconversion
            })

    return rows


def convert_rows_unit(rows: list[dict], new_unit: str) -> list[dict]:
    """
    Re-express all computed_area values in a new unit without re-running the model.
    Uses the stashed _area_sqft value set during build_table_rows.

    FIX: original was reading _area_sqft which was never set → always None.
    """
    label = UNIT_LABELS.get(new_unit, new_unit)
    result = []
    for row in rows:
        r = dict(row)
        sqft = r.get("_area_sqft")
        r["computed_area"] = _convert(sqft, new_unit)
        r["unit"] = label
        result.append(r)
    return result


def build_summary(job: AnalyzeJob, unit: str = "sqft") -> dict:
    factor = SQFT_TO.get(unit, 1.0)
    label  = UNIT_LABELS.get(unit, unit)
    return {
        "page_count":       len(job.pages),
        "eligible_pages":   len(job.eligible_pages),
        "ineligible_pages": len(job.ineligible_pages),
        "grand_total":      round(job.grand_total_sqft * factor, 2),
        "grand_total_sqft": job.grand_total_sqft,
        "unit":             label,
        "has_assumed":      job.has_assumed,
        "has_low_confidence": job.has_low_confidence,
    }