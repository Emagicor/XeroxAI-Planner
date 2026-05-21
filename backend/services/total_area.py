METERS_TO_FEET = 3.28084
SQFT_PER_SQM = 10.7639
MM_PER_FOOT = 304.8


def _to_feet(value: float, units_detected: str) -> float:
    if units_detected == "meters":
        return value * METERS_TO_FEET
    if units_detected == "mm":
        return value / MM_PER_FOOT
    return value


def _extract_layout_dimensions(data: dict) -> tuple[float | None, float | None, bool]:
    layout = data.get("layout_dimensions")
    if not isinstance(layout, dict):
        layout = {}

    width = layout.get("width_ft")
    height = layout.get("height_ft")

    if width is None:
        width = data.get("layout_width_ft")
    if height is None:
        height = data.get("layout_height_ft")

    explicitly_available = layout.get("available")
    has_values = (
        isinstance(width, (int, float))
        and isinstance(height, (int, float))
        and width > 0
        and height > 0
    )

    if explicitly_available is False:
        return None, None, False

    if has_values:
        return float(width), float(height), True

    return None, None, False


def _sum_room_areas(rooms: list) -> float:
    total = 0.0
    for room in rooms:
        area = room.get("area_sqft")
        if isinstance(area, (int, float)) and area > 0:
            total += float(area)
    return total


def apply_total_area(data: dict) -> dict:
    """
    Set total_area_sqft using deterministic rules:
    1. If overall layout width & height are on the plan → width × height (in sq ft)
    2. Otherwise → sum of all room area_sqft values
    """
    rooms = data.get("rooms") or []
    units = data.get("units_detected") or "feet"

    width, height, layout_available = _extract_layout_dimensions(data)

    if layout_available and width is not None and height is not None:
        width_ft = _to_feet(width, units)
        height_ft = _to_feet(height, units)
        total = round(width_ft * height_ft, 2)

        data["total_area_sqft"] = total
        data["total_area_source"] = "layout_dimensions"
        data["layout_dimensions_used"] = {
            "width_ft": round(width_ft, 2),
            "height_ft": round(height_ft, 2),
        }
        return data

    room_sum = _sum_room_areas(rooms)
    data["total_area_sqft"] = round(room_sum, 2)
    data["total_area_source"] = "room_sum"
    data.pop("layout_dimensions_used", None)
    return data
