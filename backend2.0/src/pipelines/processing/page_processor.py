"""Shared per-page pipeline logic for blocking and streaming analyze routes."""
from __future__ import annotations

import base64
import gc
from typing import TYPE_CHECKING

import structlog

from pipelines.processing.page_result_mapper import build_page_result
from domain.entities.job import PageResult
from infrastructure.rasterizer.page_raster import RasterizedPage
from pipelines.extraction.page_analyzer import analyze_page_safe
from pipelines.processing.page_classifier import classify_page, map_vision_page_type, should_skip_before_vision
from providers.vision.factory import create_vision_provider

if TYPE_CHECKING:
    from pipelines.processing.region_expander import AnalysisUnit

log = structlog.get_logger(__name__)


def _attach_region_metadata(result: PageResult, unit: "AnalysisUnit") -> PageResult:
    result.source_page = unit.source_page
    result.region_index = unit.region_index
    result.region_id = unit.region_id
    result.region_label = unit.region_label
    result.detection_confidence = unit.detection_confidence
    result.detection_method = unit.detection_method
    result.clip_preview = base64.b64encode(unit.jpeg_bytes).decode("ascii")
    return result


def process_analysis_unit(
    unit: "AnalysisUnit",
    total_units: int,
    *,
    session_id: str,
) -> PageResult:
    """Analyze one Grounding-DINO-clipped floor plan region."""
    page_type = __import__(
        "domain.entities.job", fromlist=["PageType"]
    ).PageType.FLOORPLAN
    classify_reason = "Grounding DINO region"

    if not unit.skip_classifier:
        page_type, classify_reason = classify_page(
            page_number=unit.source_page,
            total_pages=total_units,
            pdf_text=unit.pdf_text,
            image_bytes=unit.jpeg_bytes,
        )
        if should_skip_before_vision(page_type):
            result = PageResult(
                page_number=unit.plan_number,
                page_type=page_type,
                eligible=False,
                plan_number=unit.plan_number,
                ineligible_reason=classify_reason,
            )
            return _attach_region_metadata(result, unit)

    provider = create_vision_provider()
    try:
        raw = analyze_page_safe(
            provider,
            unit.jpeg_bytes,
            unit.mime_type,
            page_number=unit.plan_number,
            session_id=session_id,
        )
    finally:
        del provider
        gc.collect()

    page_type = map_vision_page_type(raw, page_type)
    result = build_page_result(unit.plan_number, page_type, raw)

    if not result.eligible and result.ineligible_reason:
        return _attach_region_metadata(result, unit)

    if not result.eligible:
        result.ineligible_reason = result.ineligible_reason or classify_reason

    return _attach_region_metadata(result, unit)


def process_rasterized_page(
    page: RasterizedPage,
    total_pages: int,
    *,
    session_id: str,
) -> PageResult:
    """Classify, optionally skip, or analyze one full rasterized page (legacy path)."""
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
            plan_number=page.page_number,
            ineligible_reason=classify_reason,
            source_page=page.page_number,
            region_index=1,
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
    result.source_page = page.page_number
    result.region_index = 1

    if not result.eligible and result.ineligible_reason:
        return result

    if not result.eligible:
        result.ineligible_reason = result.ineligible_reason or classify_reason

    return result
