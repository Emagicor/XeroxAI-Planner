from engines.confidence.correction_targets import (
    build_correction_targets,
    fields_to_verify,
    merge_corrections,
    room_needs_correction,
)


PASS1 = {
    "rooms": [
        {
            "name": "Kitchen",
            "bbox": [100, 100, 300, 300],
            "length_ft": 12.0,
            "width_ft": 10.0,
            "area_sqft": 120.0,
            "confidence_pct": 95,
            "dimension_source": "measured",
            "assumptions": [],
        },
        {
            "name": "Bed 2",
            "bbox": [400, 100, 600, 300],
            "length_ft": 11.0,
            "width_ft": 9.5,
            "area_sqft": 104.5,
            "confidence_pct": 78,
            "dimension_source": "derived",
            "assumptions": ["11' - 1'6\" partition"],
        },
        {
            "name": "Closet",
            "bbox": [700, 100, 800, 200],
            "length_ft": 4.0,
            "width_ft": 3.0,
            "area_sqft": 12.0,
            "confidence_pct": 55,
            "dimension_source": "assumed",
            "assumptions": [],
        },
    ],
    "floor_identification": {
        "floor_label": "First Floor",
        "confidence_pct": 92,
        "evidence": "title block",
    },
    "overall_confidence": 76,
}


def test_high_confidence_measured_room_is_frozen():
    kitchen = PASS1["rooms"][0]
    assert room_needs_correction(kitchen, threshold=84) is False
    assert fields_to_verify(kitchen, threshold=84) == []


def test_derived_room_is_correction_target():
    bed = PASS1["rooms"][1]
    assert room_needs_correction(bed, threshold=84) is True
    assert "length_ft" in fields_to_verify(bed, threshold=84)


def test_assumed_room_includes_identity_fields():
    closet = PASS1["rooms"][2]
    fields = fields_to_verify(closet, threshold=84)
    assert "name" in fields
    assert "bbox" in fields


def test_build_targets_only_includes_low_confidence_rooms():
    targets = build_correction_targets(PASS1, threshold=84)
    assert len(targets.rooms) == 2
    assert targets.rooms[0].room_index == 1
    assert targets.rooms[1].room_index == 2
    assert targets.floor_identification is None
    assert targets.scan_for_missed_rooms is True
    assert targets.existing_room_names == ["Kitchen", "Bed 2", "Closet"]
    payload = targets.to_prompt_payload()
    assert payload["existing_room_names"] == ["Kitchen", "Bed 2", "Closet"]
    assert len(payload["rooms_to_verify"]) == 2


def test_merge_updates_only_corrected_rooms():
    merged = merge_corrections(
        PASS1,
        {
            "room_corrections": [
                {
                    "room_index": 1,
                    "action": "update",
                    "length_ft": 11.5,
                    "width_ft": 9.5,
                    "area_sqft": 109.25,
                    "confidence_pct": 92,
                    "dimension_source": "measured",
                    "assumptions": [],
                },
                {
                    "room_index": 2,
                    "action": "remove",
                },
            ]
        },
    )

    assert merged["rooms"][0]["name"] == "Kitchen"
    assert merged["rooms"][0]["confidence_pct"] == 95
    assert merged["rooms"][1]["length_ft"] == 11.5
    assert merged["rooms"][1]["confidence_pct"] == 92
    assert len(merged["rooms"]) == 2
    assert merged["overall_confidence"] == round((95 + 92) / 2)


def test_merge_appends_missed_rooms():
    merged = merge_corrections(
        PASS1,
        {
            "room_corrections": [],
            "rooms_added": [
                {
                    "name": "Pantry",
                    "bbox": [50, 50, 90, 90],
                    "length_ft": 6.0,
                    "width_ft": 4.0,
                    "area_sqft": 24.0,
                    "confidence_pct": 93,
                    "dimension_source": "measured",
                    "assumptions": [],
                }
            ],
        },
    )

    assert len(merged["rooms"]) == 4
    assert merged["rooms"][-1]["name"] == "Pantry"


def test_merge_skips_duplicate_missed_room_names():
    merged = merge_corrections(
        PASS1,
        {
            "rooms_added": [
                {
                    "name": "Kitchen",
                    "bbox": [100, 100, 300, 300],
                    "length_ft": 12.0,
                    "width_ft": 10.0,
                    "area_sqft": 120.0,
                    "confidence_pct": 95,
                    "dimension_source": "measured",
                    "assumptions": [],
                }
            ],
        },
    )

    assert len(merged["rooms"]) == 3
