"""
Classifies each page as floorplan / cover / notes / etc.
Non-floorplan pages are skipped before the expensive vision model runs.

Uses PDF text layer when available, header-region OCR fallback, and page-position heuristics.
"""
from __future__ import annotations

import re

import fitz

from domain.entities.job import PageType

# Types that should never be sent to room extraction
NON_FLOORPLAN_TYPES: frozenset[PageType] = frozenset(
    {
        PageType.COVER,
        PageType.NOTES,
        PageType.SCHEDULE,
        PageType.ELEVATION,
        PageType.SECTION,
    }
)

_TYPE_KEYWORDS: dict[PageType, list[str]] = {
    PageType.FLOORPLAN: [
        "floor plan", "floorplan", "floor layout", "ground floor",
        "first floor", "second floor", "third floor", "upper floor", "lower floor",
        "basement plan", "basement", "level 1", "level 2", "level 3",
        "plan view", "unit plan", "typical unit", "reflected ceiling",
        "architectural plan", "a-1", "a1.0", "a-101", "a101",
    ],
    PageType.ELEVATION: [
        "elevation", "front elevation", "rear elevation", "side elevation",
        "north elevation", "south elevation", "east elevation", "west elevation",
        "exterior elevation",
    ],
    PageType.SECTION: [
        "section", "cross section", "longitudinal section",
        "building section", "wall section", "typical section",
    ],
    PageType.NOTES: [
        "general notes", "specifications", "abbreviations", "symbols",
        "code summary", "scope of work", "written specification",
        "project description", "narrative", "disclaimer", "legal",
        "table of contents", "contents",
    ],
    PageType.COVER: [
        "title page", "cover sheet", "cover page", "drawing index",
        "sheet index", "index of drawings", "drawing list", "sheet list",
        "issue date", "revision history", "project information",
        "architect", "consultant", "prepared by", "client",
        "transmittal", "submittal",
    ],
    PageType.SCHEDULE: [
        "door schedule", "window schedule", "room schedule",
        "finish schedule", "hardware schedule", "equipment schedule",
        "plumbing fixture schedule", "lighting schedule",
    ],
}

# Weight non-floorplan hits higher — a title block mentioning "elevation" on a plan is rare
# but "general notes" on a notes page should win.
_TYPE_WEIGHT: dict[PageType, float] = {
    PageType.FLOORPLAN: 1.0,
    PageType.COVER: 1.4,
    PageType.NOTES: 1.3,
    PageType.SCHEDULE: 1.3,
    PageType.ELEVATION: 1.2,
    PageType.SECTION: 1.2,
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def classify_page_from_text(text: str) -> PageType:
    """Score page types by keyword hits. Returns UNKNOWN if no confident match."""
    lower = _normalize_text(text)
    if not lower:
        return PageType.UNKNOWN

    scores: dict[PageType, float] = {}

    for page_type, keywords in _TYPE_KEYWORDS.items():
        hit = sum(1 for kw in keywords if kw in lower)
        if hit:
            scores[page_type] = hit * _TYPE_WEIGHT[page_type]

    if not scores:
        return PageType.UNKNOWN

    best_type = max(scores, key=lambda t: scores[t])
    best_score = scores[best_type]

    # Require minimum confidence when multiple types compete
    sorted_scores = sorted(scores.values(), reverse=True)
    if len(sorted_scores) > 1 and sorted_scores[0] - sorted_scores[1] < 0.5:
        # Tie — prefer floorplan only if it has a strong hit
        if PageType.FLOORPLAN in scores and scores[PageType.FLOORPLAN] >= 2:
            return PageType.FLOORPLAN
        return PageType.UNKNOWN

    if best_score < 1.0:
        return PageType.UNKNOWN

    return best_type


def extract_header_text_from_image(image_bytes: bytes) -> str:
    """
    Try to read title-block / header text from a rasterized page.
    Works on vector-derived JPEGs; often empty on pure scans.
    """
    try:
        doc = fitz.open(stream=image_bytes, filetype="jpeg")
        if doc.page_count == 0:
            doc.close()
            return ""
        page = doc[0]
        rect = page.rect
        header = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + rect.height * 0.22)
        text = page.get_text("text", clip=header) or page.get_text("text") or ""
        doc.close()
        return text
    except Exception:
        return ""


def should_skip_before_vision(page_type: PageType) -> bool:
    return page_type in NON_FLOORPLAN_TYPES


def map_vision_page_type(raw: dict, fallback: PageType) -> PageType:
    """Map model page_classification.page_type to domain PageType."""
    pc = raw.get("page_classification") or {}
    pt = str(pc.get("page_type") or "").lower()
    mapping = {
        "floorplan": PageType.FLOORPLAN,
        "cover": PageType.COVER,
        "notes": PageType.NOTES,
        "schedule": PageType.SCHEDULE,
        "elevation": PageType.ELEVATION,
        "section": PageType.SECTION,
        "other": PageType.UNKNOWN,
    }
    if pt in mapping:
        return mapping[pt]
    if pc.get("is_floor_plan") is False:
        return PageType.UNKNOWN
    return fallback


def classify_page(
    *,
    page_number: int,
    total_pages: int,
    pdf_text: str = "",
    image_bytes: bytes | None = None,
) -> tuple[PageType, str]:
    """
    Classify a page using PDF text, header OCR, and document structure heuristics.

    Returns:
        (page_type, human-readable reason for logging / ineligible_reason)
    """
    combined = pdf_text.strip()

    if not combined and image_bytes:
        combined = extract_header_text_from_image(image_bytes)

    if combined:
        page_type = classify_page_from_text(combined)
        if page_type != PageType.UNKNOWN:
            if should_skip_before_vision(page_type):
                return page_type, (
                    f"Pre-filter: page identified as '{page_type.value}' from sheet text."
                )
            return page_type, f"Pre-filter: floor plan keywords detected ({page_type.value})."

    # Multi-page PDF: first pages are often covers, but real uploads also place the
    # ground-floor plan first with weak/no OCR. Keep ambiguous page 1 eligible for
    # vision instead of silently dropping it.
    if total_pages > 1 and page_number == 1 and not _has_floorplan_signals(combined):
        return PageType.UNKNOWN, (
            "Ambiguous first page of multi-page PDF - vision model will verify."
        )

    # Last pages in large sets are sometimes notes/schedules without strong OCR
    if total_pages > 3 and page_number == total_pages and _looks_like_notes_page(combined):
        return PageType.NOTES, "Pre-filter: last page appears to be notes or specifications."

    if total_pages == 1:
        return PageType.FLOORPLAN, "Single-page upload — treating as floor plan."

    # Ambiguous — send to vision with page gate in prompt; model can reject
    return PageType.UNKNOWN, "Ambiguous sheet type — vision model will verify."


def _has_floorplan_signals(text: str) -> bool:
    lower = _normalize_text(text)
    if not lower:
        return False
    signals = _TYPE_KEYWORDS[PageType.FLOORPLAN]
    return any(kw in lower for kw in signals)


def _looks_like_notes_page(text: str) -> bool:
    lower = _normalize_text(text)
    if len(lower) < 40:
        return False
    notes_kw = _TYPE_KEYWORDS[PageType.NOTES] + _TYPE_KEYWORDS[PageType.SCHEDULE]
    hits = sum(1 for kw in notes_kw if kw in lower)
    return hits >= 2 and not _has_floorplan_signals(lower)
