"""Expand rasterized document pages into floor-plan analysis units."""
from __future__ import annotations

from dataclasses import dataclass

import structlog

from domain.entities.detection import DetectedRegion
from engines.detection.region_clipper import full_page_region
from infrastructure.rasterizer.page_raster import RasterizedPage
from pipelines.processing.page_classifier import classify_page, should_skip_before_vision

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class AnalysisUnit:
    """One floor plan region to send through the vision pipeline."""

    plan_number: int
    source_page: int
    region_index: int
    region_id: str
    region_label: str
    detection_confidence: float
    detection_method: str
    jpeg_bytes: bytes
    mime_type: str
    pdf_text: str
    skip_classifier: bool
    from_pdf: bool = False


def _regions_from_page(
    page: RasterizedPage,
    *,
    total_pages: int,
) -> tuple[list[DetectedRegion], bool, str | None]:
    """Return clipped regions, whether the source page is skipped, and skip reason."""
    page_type, classify_reason = classify_page(
        page_number=page.page_number,
        total_pages=total_pages,
        pdf_text=page.pdf_text,
        image_bytes=page.jpeg_bytes,
    )

    if should_skip_before_vision(page_type):
        return [], True, classify_reason

    return [
        full_page_region(
            page.jpeg_bytes,
            source_page=page.page_number,
        )
    ], False, None


def _region_to_unit(
    region: DetectedRegion,
    page: RasterizedPage,
    plan_number: int,
) -> AnalysisUnit:
    return AnalysisUnit(
        plan_number=plan_number,
        source_page=page.page_number,
        region_index=region.region_index,
        region_id=region.region_id,
        region_label=region.label,
        detection_confidence=region.confidence,
        detection_method=region.detection_method,
        jpeg_bytes=region.jpeg_bytes,
        mime_type=page.mime_type,
        pdf_text=page.pdf_text,
        skip_classifier=False,
        from_pdf=page.from_pdf,
    )


def expand_to_analysis_units(
    pages: list[RasterizedPage],
    *,
    total_pages: int | None = None,
) -> list[AnalysisUnit]:
    """Classify and clip floor plans on each page, then produce sequential analysis units."""
    total = total_pages or len(pages)
    units: list[AnalysisUnit] = []
    plan_number = 0

    for page in pages:
        regions, skipped, skip_reason = _regions_from_page(
            page, total_pages=total
        )
        if skipped:
            log.info(
                "region_expander.skip_page",
                page=page.page_number,
                reason=skip_reason,
            )
            continue

        for region in regions:
            plan_number += 1
            units.append(_region_to_unit(region, page, plan_number))

    log.info(
        "region_expander.complete",
        source_pages=len(pages),
        analysis_units=len(units),
    )
    return units
