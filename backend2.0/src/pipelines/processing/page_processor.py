"""Shared per-page pipeline logic for blocking and streaming analyze routes."""
from __future__ import annotations

import gc

import structlog

from pipelines.processing.page_result_mapper import build_page_result
from domain.entities.job import PageResult
from infrastructure.rasterizer.page_raster import RasterizedPage
from pipelines.extraction.page_analyzer import analyze_page_safe
from pipelines.processing.page_classifier import classify_page, map_vision_page_type, should_skip_before_vision
from providers.vision.factory import create_vision_provider

log = structlog.get_logger(__name__)


def process_rasterized_page(
    page: RasterizedPage,
    total_pages: int,
    *,
    session_id: str,
) -> PageResult:
    """Classify, optionally skip, or analyze one page with an isolated vision provider."""
    page_type, classify_reason = classify_page(
        page_number=page.page_number,
        total_pages=total_pages,
        pdf_text=page.pdf_text,
        image_bytes=page.jpeg_bytes,
    )

    log.info(
        "page_processor.classified",
        page=page.page_number,
        page_type=page_type.value,
        reason=classify_reason,
        session_id=session_id,
    )

    if should_skip_before_vision(page_type):
        return PageResult(
            page_number=page.page_number,
            page_type=page_type,
            eligible=False,
            ineligible_reason=classify_reason,
        )

    provider = create_vision_provider()
    try:
        raw = analyze_page_safe(
            provider,
            page.jpeg_bytes,
            page.mime_type,
            page_number=page.page_number,
            session_id=session_id,
        )
    finally:
        del provider
        gc.collect()

    page_type = map_vision_page_type(raw, page_type)
    result = build_page_result(page.page_number, page_type, raw)

    if not result.eligible and result.ineligible_reason:
        return result

    if not result.eligible:
        result.ineligible_reason = result.ineligible_reason or classify_reason

    return result
