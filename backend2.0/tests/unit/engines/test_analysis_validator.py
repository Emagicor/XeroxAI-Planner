"""Tests for the deterministic area engine."""
import pytest
from engines.area.total_area import compute_total_area, TotalAreaResult


def test_layout_dimensions_used_when_available():
    data = {
        "layout_dimensions": {"available": True, "width_ft": 40.0, "height_ft": 30.0},
        "units_detected": "feet",
        "rooms": [{"area_sqft": 100}],
    }
    result = compute_total_area(data)
    assert result.source == "layout_dimensions"
    assert result.total_sqft == 1200.0
    assert result.layout_dims_used == {"width_ft": 40.0, "height_ft": 30.0}


def test_room_sum_fallback_when_layout_unavailable():
    data = {
        "layout_dimensions": {"available": False},
        "units_detected": "feet",
        "rooms": [
            {"area_sqft": 150.0},
            {"area_sqft": 80.5},
            {"area_sqft": None},   # assumed room — must be skipped
        ],
    }
    result = compute_total_area(data)
    assert result.source == "room_sum"
    assert result.total_sqft == 230.5


def test_meters_converted_to_feet():
    data = {
        "layout_dimensions": {"available": True, "width_ft": 10.0, "height_ft": 8.0},
        "units_detected": "meters",
        "rooms": [],
    }
    result = compute_total_area(data)
    # 10m × 8m = 80 sqm = 80 × 10.7639 sqft
    assert result.source == "layout_dimensions"
    assert result.total_sqft == pytest.approx(861.11, abs=1.0)


def test_does_not_mutate_input():
    data = {"layout_dimensions": {"available": False}, "rooms": [{"area_sqft": 50}]}
    original = dict(data)
    compute_total_area(data)
    assert data == original


def test_empty_rooms_returns_zero():
    data = {"layout_dimensions": {"available": False}, "rooms": []}
    result = compute_total_area(data)
    assert result.total_sqft == 0.0


def test_layout_available_false_explicit_skips_dims():
    data = {
        "layout_dimensions": {"available": False, "width_ft": 50.0, "height_ft": 40.0},
        "rooms": [{"area_sqft": 200.0}],
    }
    result = compute_total_area(data)
    assert result.source == "room_sum"
    assert result.total_sqft == 200.0