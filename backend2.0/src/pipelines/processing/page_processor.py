"""Shared per-page pipeline logic for blocking and streaming analyze routes."""
from __future__ import annotations

import base64
import gc
from typing import TYPE_CHECKING

from pipelines.processing.page_result_mapper import build_page_result
from domain.entities.job import PageResult
from domain.entities.vision_usage import VisionUsageSnapshot
from infrastructure.preprocessing.image_preprocessor import prepare_ui_preview_image
from pipelines.extraction.page_analyzer import analyze_page_safe
from pipelines.processing.page_classifier import classify_page, map_vision_page_type, should_skip_before_vision
from providers.vision.factory import create_vision_provider
from providers.vision.request_config import VisionOverride

if TYPE_CHECKING:
    from pipelines.processing.region_expander import AnalysisUnit


def _attach_region_metadata(result: PageResult, unit: "AnalysisUnit") -> PageResult:
    result.source_page = unit.source_page
    result.region_index = unit.region_index
    result.region_id = unit.region_id
    result.region_label = unit.region_label
    result.detection_confidence = unit.detection_confidence
    result.detection_method = unit.detection_method
    preview_bytes, _ = prepare_ui_preview_image(
        unit.jpeg_bytes,
        from_pdf=unit.from_pdf,
    )
    result.clip_preview = base64.b64encode(preview_bytes).decode("ascii")
    return result


def process_analysis_unit(
    unit: "AnalysisUnit",
    total_units: int,
    *,
    session_id: str,
    vision_override: VisionOverride | None = None,
) -> PageResult:
    """Analyze one floor plan region (full page or clipped)."""
    page_type = __import__(
        "domain.entities.job", fromlist=["PageType"]
    ).PageType.FLOORPLAN
    classify_reason = "Detected floor plan region"

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

    provider = create_vision_provider(vision_override)
    vision_usage: VisionUsageSnapshot | None = None
    try:
        raw, vision_usage = analyze_page_safe(
            provider,
            unit.jpeg_bytes,
            unit.mime_type,
            page_number=unit.plan_number,
            session_id=session_id,
            from_pdf=unit.from_pdf,
            vision_override=vision_override,
        )
    finally:
        del provider
        gc.collect()

    page_type = map_vision_page_type(raw, page_type)
    result = build_page_result(unit.plan_number, page_type, raw)
    result.vision_usage = vision_usage

    if not result.eligible and result.ineligible_reason:
        return _attach_region_metadata(result, unit)

    if not result.eligible:
        result.ineligible_reason = result.ineligible_reason or classify_reason

    return _attach_region_metadata(result, unit)
