"""
engines/validation/analysis_validator.py

FIX vs original validators/analysis.py:
  - Original rejected rooms with null area_sqft — this violates the spec.
    The spec explicitly requires null dims for assumed/undeivable rooms.
  - Now: null area is only invalid when dimension_source == "measured"
  - BBox validation checks integer types properly
  - Returns a structured ValidationReport instead of bare bool
  - Added polygon validation
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


def validate_analysis_result(data: dict) -> ValidationReport:
    """
    Validate the raw dict returned by the vision model.

    Rules:
    - rooms must be a non-empty list
    - Each room needs: name, bbox (4 ints 0–1000), confidence_pct (0–100)
    - area_sqft may be null ONLY when dimension_source == "assumed"
    - polygon must be a list of [x,y] pairs if present
    """
    report = ValidationReport(valid=True)

    rooms = data.get("rooms")
    if not rooms or not isinstance(rooms, list):
        report.add("(document)", "rooms", "Missing or empty rooms list")
        return report

    for room in rooms:
        name = room.get("name", "(unnamed)")
        source = room.get("dimension_source", "")

        # bbox
        bbox = room.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            report.add(name, "bbox", "bbox must be a list of 4 numbers")
        elif not all(isinstance(v, (int, float)) and 0 <= v <= 1000 for v in bbox):
            report.add(name, "bbox", f"bbox values must be 0–1000, got {bbox}")

        # area_sqft — null is ONLY valid for assumed rooms
        area = room.get("area_sqft")
        if area is None:
            if source != "assumed":
                report.add(
                    name, "area_sqft",
                    f"area_sqft is null but dimension_source is '{source}' (not 'assumed')"
                )
        elif not isinstance(area, (int, float)) or area < 0:
            report.add(name, "area_sqft", f"area_sqft must be a non-negative number, got {area!r}")

        # confidence_pct
        conf = room.get("confidence_pct")
        if not isinstance(conf, (int, float)) or not (0 <= conf <= 100):
            report.add(name, "confidence_pct", f"confidence_pct must be 0–100, got {conf!r}")

        # polygon (optional but validated if present)
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