"""
infrastructure/rasterizer/pdf_rasterizer.py

Converts PDF pages to JPEG bytes using PyMuPDF (fitz).
No poppler dependency — works on all platforms without PATH configuration.

FIX vs original pdf.py:
  - Removed hardcoded Windows poppler path
  - Replaced pdf2image with PyMuPDF (faster, zero system dep)
  - DPI comes from settings, not a magic number
  - Proper error wrapping
  - Returns all pages, not just first
"""
from __future__ import annotations

from io import BytesIO

import fitz  # PyMuPDF

from config.settings import get_settings
from domain.exceptions import RasterizationError


def rasterize_pdf(pdf_bytes: bytes) -> list[tuple[bytes, str]]:
    """
    Convert every page of a PDF to JPEG bytes.

    Returns:
        List of (jpeg_bytes, "image/jpeg") — one per page, preserving page order.

    Raises:
        RasterizationError: if the PDF cannot be opened or a page fails to render.
    """
    settings = get_settings()
    dpi = settings.pdf_render_dpi

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise RasterizationError(
            code="PDF_OPEN_FAILED",
            message=f"Could not open PDF for rasterization: {exc}",
            details={"detail": str(exc)},
        ) from exc

    results: list[tuple[bytes, str]] = []

    for page_num in range(doc.page_count):
        try:
            page = doc.load_page(page_num)

            # Respect embedded page rotation (deskew handles scan rotation separately)
            mat = fitz.Matrix(dpi / 72, dpi / 72)   # 72 pt/inch → target DPI
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB, alpha=False)

            jpeg_bytes = pix.tobytes(output="jpeg")
            results.append((jpeg_bytes, "image/jpeg"))

        except Exception as exc:
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


def rasterize_single_image(image_bytes: bytes, mime_type: str) -> list[tuple[bytes, str]]:
    """
    Wraps a single uploaded image as a one-page list for uniform pipeline handling.
    """
    return [(image_bytes, mime_type)]