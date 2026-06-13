from pathlib import Path

import pytest

from providers.vision.json_parse import parse_provider_json

_FIXTURE_DIR = Path(__file__).resolve().parents[3] / "_vision_prompt_logs"


def test_parse_arithmetic_expressions_in_values():
    raw = """{
  "layout_dimensions": {
    "available": true,
    "width_ft": 96 + 6/12,
    "height_ft": 86 + 5/12,
    "source": "measured"
  },
  "rooms": []
}"""
    data = parse_provider_json(raw)
    assert data["layout_dimensions"]["width_ft"] == 96.5
    assert data["layout_dimensions"]["height_ft"] == pytest.approx(86 + 5 / 12)


def test_parse_trailing_commas_and_fences():
    raw = """```json
{
  "rooms": [],
  "total_area_sqft": 0,
}
```"""
    data = parse_provider_json(raw)
    assert data["rooms"] == []
    assert data["total_area_sqft"] == 0


def test_parse_real_gpt4o_floor_plan_log_if_present():
    log_path = _FIXTURE_DIR / "latest_floor_plan_output.txt"
    if not log_path.is_file():
        pytest.skip("vision prompt log not available")

    lines = log_path.read_text(encoding="utf-8").splitlines()
    json_start = next((i for i, line in enumerate(lines) if line.strip() == "{"), None)
    if json_start is None:
        pytest.skip("no JSON block in vision prompt log")

    raw = "\n".join(lines[json_start:])
    data = parse_provider_json(raw)
    assert data["page_classification"]["is_floor_plan"] is True
    assert len(data["rooms"]) >= 1
    assert data["layout_dimensions"]["width_ft"] == 96.5


def test_parse_invalid_json_still_raises():
    with pytest.raises(Exception) as exc_info:
        parse_provider_json("{not json at all")
    assert exc_info.value.code == "JSON_PARSE_ERROR"
