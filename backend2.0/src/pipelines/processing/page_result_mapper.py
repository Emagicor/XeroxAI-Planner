"""Map raw vision-model output to typed PageResult."""
from __future__ import annotations

from domain.entities.job import DimensionSource, PageResult, PageType, RoomResult


def _confidence(value) -> int | None:
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, n))


def build_page_result(page_number: int, page_type: PageType, raw: dict) -> PageResult:
    floor = raw.get("floor_identification") or {}

    if not raw.get("eligible", True):
        return PageResult(
            page_number=page_number,
            page_type=page_type,
            eligible=False,
            plan_number=page_number,
            floor_label=floor.get("floor_label") or floor.get("label"),
            floor_label_confidence=_confidence(floor.get("confidence_pct")),
            ineligible_reason=raw.get("reason", "Extraction failed"),
        )

    rooms: list[RoomResult] = [_build_room(r) for r in (raw.get("rooms") or [])]

    page = PageResult(
        page_number=page_number,
        page_type=page_type,
        eligible=True,
        plan_number=page_number,
        floor_label=floor.get("floor_label") or floor.get("label"),
        floor_label_confidence=_confidence(floor.get("confidence_pct")),
        rooms=rooms,
        total_area_sqft=float(raw.get("total_area_sqft") or 0),
        total_area_source=raw.get("total_area_source", "room_sum"),
        layout_dimensions_used=raw.get("layout_dimensions_used"),
        overall_confidence=int(raw.get("overall_confidence") or 0),
        units_detected=raw.get("units_detected", "feet"),
        annotated_image=raw.get("annotated_image"),
    )
    page.compute_totals()
    return page


def _build_room(r: dict) -> RoomResult:
    source_str = r.get("dimension_source", "assumed")
    try:
        source = DimensionSource(source_str)
    except ValueError:
        source = DimensionSource.ASSUMED

    return RoomResult(
        name=r.get("name", "Unknown"),
        bbox=r.get("bbox", [0, 0, 0, 0]),
        polygon=r.get("polygon", []),
        length_ft=r.get("length_ft"),
        width_ft=r.get("width_ft"),
        area_sqft=r.get("area_sqft"),
        confidence_pct=int(r.get("confidence_pct") or 0),
        dimension_source=source,
        assumptions=r.get("assumptions") or [],
    )
