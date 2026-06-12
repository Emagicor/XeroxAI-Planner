"""
Selective correction targets — only low-confidence pass-1 fields go to pass 2.

Confidence tiers (aligned with FLOOR_PLAN_PROMPT):
  - high (>= correction threshold, measured): frozen — no correction API payload
  - medium (derived or confidence at/below threshold): dimension fields verified
  - low (< MEDIUM_CONFIDENCE_MIN or assumed): full room re-verification / removal
"""
from __future__ import annotations

import copy
from dataclasses import asdict, dataclass, field

from config.constants import MEDIUM_CONFIDENCE_MIN

_DIMENSION_FIELDS = ("length_ft", "width_ft", "area_sqft", "dimension_source", "assumptions")
_IDENTITY_FIELDS = ("name", "bbox")


def _coerce_confidence(value: object) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 50


def _room_source(room: dict) -> str:
    return str(room.get("dimension_source") or "").lower()


def _is_high_confidence_measured(room: dict, *, threshold: int) -> bool:
    """Pass-1 rooms that are frozen — never sent to correction."""
    conf = _coerce_confidence(room.get("confidence_pct"))
    source = _room_source(room)
    return source == "measured" and conf > threshold


def fields_to_verify(room: dict, *, threshold: int) -> list[str]:
    """Fields the correction pass should re-read for one room."""
    if _is_high_confidence_measured(room, threshold=threshold):
        return []

    conf = _coerce_confidence(room.get("confidence_pct"))
    source = _room_source(room)
    fields: list[str] = list(_DIMENSION_FIELDS)

    if conf < MEDIUM_CONFIDENCE_MIN or source == "assumed":
        fields.extend(_IDENTITY_FIELDS)

    return list(dict.fromkeys(fields))


def room_needs_correction(room: dict, *, threshold: int) -> bool:
    if _is_high_confidence_measured(room, threshold=threshold):
        return False

    conf = _coerce_confidence(room.get("confidence_pct"))
    source = _room_source(room)
    if source in ("assumed", "derived"):
        return True
    return conf <= threshold


@dataclass
class RoomCorrectionTarget:
    room_index: int
    name: str
    fields_to_verify: list[str]
    current: dict = field(default_factory=dict)


@dataclass
class CorrectionTargets:
    rooms: list[RoomCorrectionTarget] = field(default_factory=list)
    floor_identification: dict | None = None
    existing_room_names: list[str] = field(default_factory=list)
    scan_for_missed_rooms: bool = True

    @property
    def has_targets(self) -> bool:
        return (
            bool(self.rooms)
            or self.floor_identification is not None
            or self.scan_for_missed_rooms
        )

    def to_prompt_payload(self) -> dict:
        payload: dict = {
            "scan_for_missed_rooms": self.scan_for_missed_rooms,
            "existing_room_names": self.existing_room_names,
        }
        if self.rooms:
            payload["rooms_to_verify"] = [asdict(room) for room in self.rooms]
        if self.floor_identification is not None:
            payload["floor_identification"] = self.floor_identification
        return payload


def _current_field_values(room: dict, fields: list[str]) -> dict:
    current: dict = {}
    for key in fields:
        if key in room:
            current[key] = room.get(key)
    return current


def build_correction_targets(
    data: dict,
    *,
    threshold: int,
    include_all_rooms: bool = False,
) -> CorrectionTargets:
    """
    Build the minimal payload for pass 2.

    When include_all_rooms is True (structurally weak pass-1), every room is
    sent for verification even if individually high-confidence.
    """
    rooms = data.get("rooms") or []
    room_targets: list[RoomCorrectionTarget] = []

    for index, room in enumerate(rooms):
        if not isinstance(room, dict):
            continue
        verify_fields = (
            list(dict.fromkeys([*_DIMENSION_FIELDS, *_IDENTITY_FIELDS]))
            if include_all_rooms
            else fields_to_verify(room, threshold=threshold)
        )
        if not include_all_rooms and not room_needs_correction(room, threshold=threshold):
            continue
        if not verify_fields:
            continue
        room_targets.append(
            RoomCorrectionTarget(
                room_index=index,
                name=str(room.get("name") or f"Room {index + 1}"),
                fields_to_verify=verify_fields,
                current=_current_field_values(room, verify_fields),
            )
        )

    floor_target = None
    floor = data.get("floor_identification") or {}
    floor_conf = _coerce_confidence(floor.get("confidence_pct"))
    if floor and floor_conf <= threshold:
        floor_target = {
            "fields_to_verify": ["floor_label", "confidence_pct", "evidence"],
            "current": {
                "floor_label": floor.get("floor_label"),
                "confidence_pct": floor_conf,
                "evidence": floor.get("evidence"),
            },
        }

    existing_names = [
        str(room.get("name") or f"Room {index + 1}")
        for index, room in enumerate(rooms)
        if isinstance(room, dict)
    ]

    return CorrectionTargets(
        rooms=room_targets,
        floor_identification=floor_target,
        existing_room_names=existing_names,
        scan_for_missed_rooms=True,
    )


def merge_corrections(pass1: dict, correction: dict) -> dict:
    """Apply compact pass-2 corrections onto pass-1; high-confidence rooms stay frozen."""
    result = copy.deepcopy(pass1)
    rooms: list[dict | None] = [
        dict(room) if isinstance(room, dict) else None
        for room in (result.get("rooms") or [])
    ]

    for fix in correction.get("room_corrections") or []:
        if not isinstance(fix, dict):
            continue
        index = fix.get("room_index")
        if not isinstance(index, int) or index < 0 or index >= len(rooms):
            continue

        action = str(fix.get("action") or "update").lower()
        if action == "remove":
            rooms[index] = None
            continue

        room = rooms[index]
        if room is None:
            continue

        for field in (
            "name",
            "length_ft",
            "width_ft",
            "area_sqft",
            "confidence_pct",
            "dimension_source",
            "assumptions",
            "bbox",
            "polygon",
        ):
            if field in fix:
                room[field] = fix[field]
        rooms[index] = room

    result["rooms"] = [room for room in rooms if room is not None]

    for new_room in correction.get("rooms_added") or []:
        if not isinstance(new_room, dict):
            continue
        name = str(new_room.get("name") or "").strip()
        if not name:
            continue
        if any(
            str(existing.get("name") or "").strip().lower() == name.lower()
            for existing in result["rooms"]
            if isinstance(existing, dict)
        ):
            continue
        result["rooms"].append(dict(new_room))

    floor_fix = correction.get("floor_identification")
    if isinstance(floor_fix, dict) and floor_fix:
        result["floor_identification"] = {
            **(result.get("floor_identification") or {}),
            **floor_fix,
        }

    return recompute_overall_confidence(result)


def recompute_overall_confidence(data: dict) -> dict:
    rooms = data.get("rooms") or []
    if rooms:
        data["overall_confidence"] = round(
            sum(_coerce_confidence(room.get("confidence_pct")) for room in rooms) / len(rooms)
        )
    return data
