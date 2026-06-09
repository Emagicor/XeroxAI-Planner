"""
Converts PDF pages to raster images using PyMuPDF (fitz).
Extracts embedded text per page for sheet-type classification.

CAD / architectural PDF color fidelity (PyMuPDF known behavior):
  - colorspace=fitz.csRGB  — explicit RGB, avoids implicit gamma shifts on cyan-blues
  - alpha=False            — flatten onto white; alpha=True + manual flatten washes colors
  - annots=True            — include annotation layers (blue dims are often annots)
  - dpi >= 216 (3x zoom)   — thin anti-aliased lines fade into white at low resolution

Default settings use 300 DPI + lossless PNG.
"""
from __future__ import annotations

import fitz
from PIL import Image

from config.settings import get_settings
from domain.exceptions import RasterizationError
from infrastructure.imaging.color_fidelity import open_image, save_image
from infrastructure.rasterizer.page_raster import RasterizedPage


def _extract_page_text(page: fitz.Page) -> str:
    try:
        return page.get_text("text") or ""
    except Exception:
        return ""


def _render_page_pixmap(page: fitz.Page, dpi: int) -> fitz.Pixmap:
    """Render one page with CAD-safe PyMuPDF settings (see module docstring)."""
    zoom = dpi / 72  # PDF base is 72 pt/in; 300 → ~4.17x
    mat = fitz.Matrix(zoom, zoom)
    return page.get_pixmap(
        matrix=mat,
        colorspace=fitz.csRGB,
        alpha=False,
        annots=True,
    )


def _render_page_image(page: fitz.Page, dpi: int) -> Image.Image:
    """PIL RGB image from a CAD-safe pixmap (PNG round-trip for PyMuPDF 1.24+)."""
    pix = _render_page_pixmap(page, dpi)
    return open_image(pix.tobytes("png"))


def rasterize_pdf(pdf_bytes: bytes) -> list[RasterizedPage]:
    """
    Convert every page of a PDF to raster bytes plus embedded text.

    Returns:
        List of RasterizedPage — one per page, preserving order (1-based page_number).
    """
    settings = get_settings()
    dpi = settings.pdf_render_dpi
    raster_fmt = settings.pdf_raster_format
    jpeg_quality = settings.pdf_render_jpeg_quality

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise RasterizationError(
            code="PDF_OPEN_FAILED",
            message=f"Could not open PDF for rasterization: {exc}",
            details={"detail": str(exc)},
        ) from exc

    results: list[RasterizedPage] = []

    for page_num in range(doc.page_count):
        try:
            page = doc.load_page(page_num)
            pdf_text = _extract_page_text(page)
            pix = _render_page_pixmap(page, dpi)
            if raster_fmt.lower().strip() == "jpeg":
                image_bytes, mime_type = save_image(
                    open_image(pix.tobytes("png")),
                    fmt=raster_fmt,
                    jpeg_quality=jpeg_quality,
                )
            else:
                image_bytes = pix.tobytes("png")
                mime_type = "image/png"

            results.append(
                RasterizedPage(
                    page_number=page_num + 1,
                    jpeg_bytes=image_bytes,
                    mime_type=mime_type,
                    pdf_text=pdf_text,
                    from_pdf=True,
                )
            )
        except Exception as exc:
            doc.close()
            raise RasterizationError(
                code="PAGE_RENDER_FAILED",
                message=f"Failed to render page {page_num + 1}: {exc}",
                details={"page": page_num + 1, "detail": str(exc)},
            ) from exc

    doc.close()

    if not results:
        raise RasterizationError(
            code="NO_PAGES_RENDERED",
            message="PDF produced no renderable pages.",
        )

    return results


def rasterize_single_image(image_bytes: bytes, mime_type: str) -> list[RasterizedPage]:
    """Wrap a single uploaded image as a one-page list for uniform pipeline handling."""
    return [
        RasterizedPage(
            page_number=1,
            jpeg_bytes=image_bytes,
            mime_type=mime_type,
            pdf_text="",
            from_pdf=False,
        )
    ]


def rasterize_pdf_legacy_tuples(pdf_bytes: bytes) -> list[tuple[bytes, str]]:
    """Backward-compatible tuple API for callers expecting (bytes, mime)."""
    return [(p.jpeg_bytes, p.mime_type) for p in rasterize_pdf(pdf_bytes)]
