"""Unit tests for floor-plan region expansion logic."""
from __future__ import annotations

from unittest.mock import patch

from domain.entities.detection import BoundingBox
from infrastructure.rasterizer.page_raster import RasterizedPage
from pipelines.processing.region_expander import expand_to_analysis_units


def _fake_page(page_number: int = 1) -> RasterizedPage:
    from PIL import Image
    import io

    img = Image.new("RGB", (400, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return RasterizedPage(
        page_number=page_number,
        jpeg_bytes=buf.getvalue(),
        mime_type="image/jpeg",
        pdf_text="FIRST FLOOR PLAN",
    )


@patch("pipelines.processing.region_expander.detect_floor_plan_boxes")
def test_expand_single_full_page_fallback(mock_detect):
    mock_detect.return_value = (
        [(BoundingBox(0, 0, 400, 300), 1.0, "full page")],
        "full_page_fallback",
    )
    units = expand_to_analysis_units([_fake_page()])
    assert len(units) == 1
    assert units[0].source_page == 1
    assert units[0].region_index == 1


@patch("pipelines.processing.region_expander.detect_floor_plan_boxes")
def test_expand_multi_region_on_one_page(mock_detect):
    mock_detect.return_value = (
        [
            (BoundingBox(10, 10, 180, 140), 0.9, "floor plan"),
            (BoundingBox(200, 10, 390, 140), 0.85, "floor plan"),
        ],
        "grounding_dino",
    )
    units = expand_to_analysis_units([_fake_page()])
    assert len(units) == 2
    assert units[0].region_index == 1
    assert units[1].region_index == 2
    assert units[0].skip_classifier is True
    assert units[1].skip_classifier is True
