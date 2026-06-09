"""Rasterized page with optional PDF text layer for classification."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RasterizedPage:
    page_number: int
    jpeg_bytes: bytes
    mime_type: str
    pdf_text: str
    from_pdf: bool = False
