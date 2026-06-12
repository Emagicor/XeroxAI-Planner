"""Unit tests for floor-plan region expansion logic."""
from __future__ import annotations

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


def test_expand_single_full_page():
    units = expand_to_analysis_units([_fake_page()])
    assert len(units) == 1
    assert units[0].source_page == 1
    assert units[0].region_index == 1
    assert units[0].detection_method == "full_page_fallback"
    assert units[0].skip_classifier is False
