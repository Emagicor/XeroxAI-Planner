"""Regression tests for PDF rasterization color fidelity."""
from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from PIL import Image

from infrastructure.rasterizer.pdf_rasterizer import _render_page_image, _render_page_pixmap

_REPO_ROOT = Path(__file__).resolve().parents[4]
_DATA31_PDF = _REPO_ROOT / "test-suite" / "cases" / "data31" / "input.pdf"
_DERMAT_PDF = Path(r"c:\Users\ASUS\Downloads\Dermat Clinic- Floor Plan.pdf")


def _mean_brightness(img: Image.Image, step: int = 8) -> float:
    total = 0.0
    count = 0
    for y in range(0, img.height, step):
        for x in range(0, img.width, step):
            r, g, b = img.getpixel((x, y))[:3]
            total += (r + g + b) / 3
            count += 1
    return total / count if count else 0.0


def _pale_fill_pixel_count(img: Image.Image, step: int = 4) -> int:
    """Count pixels near the Dermat Clinic light-blue fill (204, 229, 255)."""
    count = 0
    target = (204, 229, 255)
    tolerance = 25
    for y in range(0, img.height, step):
        for x in range(0, img.width, step):
            r, g, b = img.getpixel((x, y))[:3]
            if all(abs(channel - target[i]) <= tolerance for i, channel in enumerate((r, g, b))):
                count += 1
    return count


def _broken_pil_alpha_composite(page: fitz.Page, dpi: int = 150) -> Image.Image:
    """Old bug: alpha=True + PIL composite loses pale vector fills."""
    from infrastructure.imaging.color_fidelity import composite_on_white

    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=True, annots=True)
    if pix.colorspace is None or pix.colorspace.n != 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    rgba = Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
    return composite_on_white(rgba)


def test_render_page_pixmap_uses_cad_safe_pymupdf_settings(monkeypatch):
    """Regression: alpha=False, csRGB, annots=True — required for CAD blue lines."""
    captured: dict = {}

    class FakePixmap:
        def tobytes(self, output: str) -> bytes:
            return b"fake"

    def fake_get_pixmap(self, **kwargs):
        captured.update(kwargs)
        return FakePixmap()

    monkeypatch.setattr(fitz.Page, "get_pixmap", fake_get_pixmap)
    doc = fitz.open()
    try:
        doc.insert_page(-1)
        _render_page_pixmap(doc[0], dpi=300)
    finally:
        doc.close()

    assert captured.get("colorspace") == fitz.csRGB
    assert captured.get("alpha") is False
    assert captured.get("annots") is True
    mat = captured.get("matrix")
    assert mat is not None
    assert abs(mat.a - 300 / 72) < 0.01


@pytest.mark.skipif(not _DATA31_PDF.is_file(), reason="data31 fixture PDF missing")
def test_render_page_image_does_not_flatten_transparency_onto_black():
    """Transparent PDF layers must not become a near-black page."""
    doc = fitz.open(_DATA31_PDF)
    try:
        page = doc[0]
        img = _render_page_image(page, dpi=150)
        assert _mean_brightness(img) > 180
    finally:
        doc.close()


@pytest.mark.skipif(not _DERMAT_PDF.is_file(), reason="Dermat Clinic fixture PDF missing")
def test_render_page_image_preserves_pale_blue_markings():
    """Semi-transparent light-blue markup must match PDF-viewer rendering."""
    doc = fitz.open(_DERMAT_PDF)
    try:
        page = doc[0]
        good = _render_page_image(page, dpi=150)
        broken = _broken_pil_alpha_composite(page, dpi=150)
        assert _pale_fill_pixel_count(good) > _pale_fill_pixel_count(broken) * 10
    finally:
        doc.close()
