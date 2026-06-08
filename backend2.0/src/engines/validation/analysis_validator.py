"""
engines/validation/analysis_validator.py

Validates sanitized vision output. Null area is allowed when length×width or
area-only annotations are present; assumed rooms with no data are dropped in sanitize.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RoomValidationIssue:
    room_name: str
    field: str
    reason: str


@dataclass
class ValidationReport:
    valid: bool
    issues: list[RoomValidationIssue] = field(default_factory=list)

    def add(self, room_name: str, field_name: str, reason: str) -> None:
        self.issues.append(RoomValidationIssue(room_name, field_name, reason))
        self.valid = False


def _has_positive_number(value: object) -> bool:
    return isinstance(value, (int, float)) and float(value) > 0


def validate_analysis_result(data: dict) -> ValidationReport:
    """
    Validate the sanitized dict returned by the vision model.

    Rules:
    - rooms must be a non-empty list
    - Each room needs: name, bbox (4 values 0–1000), confidence_pct (0–100)
    - Each room needs area_sqft > 0 OR both length_ft and width_ft > 0
    - polygon must be a list of [x,y] pairs if present
    """
    report = ValidationReport(valid=True)

    rooms = data.get("rooms")
    if not rooms or not isinstance(rooms, list):
        report.add("(document)", "rooms", "Missing or empty rooms list")
        return report

    for room in rooms:
        name = room.get("name", "(unnamed)")

        bbox = room.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            report.add(name, "bbox", "bbox must be a list of 4 numbers")
        elif not all(isinstance(v, (int, float)) and 0 <= v <= 1000 for v in bbox):
            report.add(name, "bbox", f"bbox values must be 0–1000, got {bbox}")

        length = room.get("length_ft")
        width = room.get("width_ft")
        area = room.get("area_sqft")
        has_dims = _has_positive_number(length) and _has_positive_number(width)
        has_area = _has_positive_number(area)

        if not has_dims and not has_area:
            report.add(
                name,
                "area_sqft",
                "room must have area_sqft > 0 or both length_ft and width_ft > 0",
            )

        if area is not None and not isinstance(area, (int, float)):
            report.add(name, "area_sqft", f"area_sqft must be numeric, got {area!r}")
        elif isinstance(area, (int, float)) and area < 0:
            report.add(name, "area_sqft", f"area_sqft must be non-negative, got {area!r}")

        conf = room.get("confidence_pct")
        if not isinstance(conf, (int, float)) or not (0 <= conf <= 100):
            report.add(name, "confidence_pct", f"confidence_pct must be 0–100, got {conf!r}")

        polygon = room.get("polygon")
        if polygon is not None:
            if not isinstance(polygon, list) or len(polygon) < 3:
                report.add(name, "polygon", "polygon must have at least 3 points")
            else:
                for pt in polygon:
                    if not (isinstance(pt, list) and len(pt) == 2):
                        report.add(name, "polygon", f"Each polygon point must be [x, y], got {pt!r}")
                        break

    return report


def is_valid(data: dict) -> bool:
    """Convenience helper — True if no validation issues."""
    return validate_analysis_result(data).valid
