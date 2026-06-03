from engines.dimensions.parse import parse_dimension_to_feet
from engines.dimensions.sanitize import sanitize_vision_rooms


def test_parse_feet_inches():
    assert parse_dimension_to_feet("12'-6\"") == 12.5
    assert parse_dimension_to_feet("10'-0\"") == 10.0


def test_sanitize_recomputes_area():
    data = {
        "rooms": [
            {
                "name": "Bed",
                "bbox": [0, 0, 100, 100],
                "length_ft": 12,
                "width_ft": 10,
                "area_sqft": 999,
                "confidence_pct": 90,
                "dimension_source": "measured",
            }
        ]
    }
    out = sanitize_vision_rooms(data)
    assert out["rooms"][0]["area_sqft"] == 120.0
