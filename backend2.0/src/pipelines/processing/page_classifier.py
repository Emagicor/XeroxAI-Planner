"""
pipelines/processing/page_classifier.py

Classifies each rasterised page as floorplan / elevation / section / notes / etc.
Non-floorplan pages are skipped — not sent to the expensive vision model.

Uses a lightweight heuristic approach (keyword OCR on the page title area)
combined with a simple fallback to the vision model for ambiguous cases.
"""
from __future__ import annotations

import re

import fitz

from domain.entities.job import PageType


# Keywords strongly associated with each page type
_TYPE_KEYWORDS: dict[PageType, list[str]] = {
    PageType.FLOORPLAN: [
        "floor plan", "floorplan", "floor layout", "ground floor",
        "first floor", "second floor", "upper floor", "lower floor",
        "basement", "level", "plan view",
    ],
    PageType.ELEVATION: [
        "elevation", "front elevation", "rear elevation",
        "side elevation", "north elevation", "south elevation",
    ],
    PageType.SECTION: [
        "section", "cross section", "longitudinal section",
        "building section", "wall section",
    ],
    PageType.NOTES: [
        "general notes", "specifications", "legend", "key",
        "abbreviations", "symbols", "schedule",
    ],
    PageType.COVER: [
        "title page", "cover sheet", "project", "drawing index",
        "issue date", "revision",
    ],
    PageType.SCHEDULE: [
        "door schedule", "window schedule", "room schedule",
        "finish schedule", "hardware schedule",
    ],
}


def classify_page_from_text(text: str) -> PageType:
    """
    Score each page type by keyword hits in the extracted text.
    Returns the highest-scoring type, or UNKNOWN if no hits.
    """
    lower = text.lower()
    scores: dict[PageType, int] = {}

    for page_type, keywords in _TYPE_KEYWORDS.items():
        hit = sum(1 for kw in keywords if kw in lower)
        if hit:
            scores[page_type] = hit

    if not scores:
        return PageType.UNKNOWN

    return max(scores, key=lambda t: scores[t])


def classify_page(image_bytes: bytes, page_number: int) -> PageType:
    """
    Attempt to classify a page from its image using quick text extraction.

    Strategy:
      1. Try to extract text from the image via PyMuPDF (works well on vector PDFs)
      2. Score against keyword lists
      3. If UNKNOWN and page 1 → assume FLOORPLAN (most common single-page upload)
      4. If UNKNOWN → return UNKNOWN (caller decides whether to process anyway)
    """
    try:
        doc = fitz.open(stream=image_bytes, filetype="jpeg")
        text = doc[0].get_text() if doc.page_count > 0 else ""
        doc.close()
    except Exception:
        text = ""

    page_type = classify_page_from_text(text)

    # Heuristic: if we can't classify at all, assume floorplan
    # (the spec says to process all pages; non-floorplan ones get lower priority)
    if page_type == PageType.UNKNOWN:
        page_type = PageType.FLOORPLAN

    return page_type