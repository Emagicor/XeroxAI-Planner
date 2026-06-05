"""
Converts PDF pages to JPEG bytes using PyMuPDF (fitz).
Extracts embedded text per page for sheet-type classification.
"""
from __future__ import annotations

import fitz

from config.settings import get_settings
from domain.exceptions import RasterizationError
from infrastructure.rasterizer.page_raster import RasterizedPage


def _extract_page_text(page: fitz.Page) -> str:
    try:
        return page.get_text("text") or ""
    except Exception:
        return ""


def rasterize_pdf(pdf_bytes: bytes) -> list[RasterizedPage]:
    """
    Convert every page of a PDF to JPEG bytes plus embedded text.

    Returns:
        List of RasterizedPage — one per page, preserving order (1-based page_number).
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

    results: list[RasterizedPage] = []

    for page_num in range(doc.page_count):
        try:
            page = doc.load_page(page_num)
            pdf_text = _extract_page_text(page)

            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB, alpha=False)
            jpeg_bytes = pix.tobytes(output="jpeg")

            results.append(
                RasterizedPage(
                    page_number=page_num + 1,
                    jpeg_bytes=jpeg_bytes,
                    mime_type="image/jpeg",
                    pdf_text=pdf_text,
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
        )
    ]


def rasterize_pdf_legacy_tuples(pdf_bytes: bytes) -> list[tuple[bytes, str]]:
    """Backward-compatible tuple API for callers expecting (bytes, mime)."""
    return [(p.jpeg_bytes, p.mime_type) for p in rasterize_pdf(pdf_bytes)]
