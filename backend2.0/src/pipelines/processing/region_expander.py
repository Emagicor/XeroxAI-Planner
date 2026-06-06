"""Expand rasterized document pages into floor-plan analysis units."""
from __future__ import annotations

import io
from dataclasses import dataclass

import structlog
from PIL import Image

from domain.entities.detection import DetectedRegion, DocumentDetection, SourcePageDetection
from engines.detection.floor_plan_detector import detect_floor_plan_boxes
from engines.detection.region_clipper import clip_region, full_page_region
from engines.detection.region_content_classifier import (
    REGION_KIND_DIMENSION_TABLE,
    classify_region_content,
    is_table_like_bbox,
)
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


def _dino_found_plans(method: str, boxes: list) -> bool:
    return method == "grounding_dino" and len(boxes) > 0


def _annotate_region_kinds(
    regions: list[DetectedRegion],
    *,
    page_width: int,
    page_height: int,
) -> list[DetectedRegion]:
    """Tag each region; suggest excluding dimension tables when other plans exist."""
    if not regions:
        return regions

    for region in regions:
        if is_table_like_bbox(region.bbox, page_width, page_height):
            region.region_kind = REGION_KIND_DIMENSION_TABLE
        else:
            region.region_kind = classify_region_content(region.jpeg_bytes)

    floor_plans = [
        r for r in regions if r.region_kind != REGION_KIND_DIMENSION_TABLE
    ]
    if len(regions) > 1 and floor_plans:
        for region in regions:
            if region.region_kind == REGION_KIND_DIMENSION_TABLE:
                region.suggested_exclude = True
    return regions


def _regions_from_page(
    page: RasterizedPage,
    *,
    total_pages: int,
) -> tuple[list[DetectedRegion], bool, str | None]:
    """Return clipped regions, whether the source page is skipped, and skip reason."""
    boxes, method = detect_floor_plan_boxes(page.jpeg_bytes)
    page_type, classify_reason = classify_page(
        page_number=page.page_number,
        total_pages=total_pages,
        pdf_text=page.pdf_text,
        image_bytes=page.jpeg_bytes,
    )

    if _dino_found_plans(method, boxes):
        img = Image.open(io.BytesIO(page.jpeg_bytes))
        pw, ph = img.size
        regions = [
            clip_region(
                page.jpeg_bytes,
                bbox,
                source_page=page.page_number,
                region_index=idx,
                label=label,
                confidence=score,
                detection_method=method,
            )
            for idx, (bbox, score, label) in enumerate(boxes, start=1)
        ]
        regions = _annotate_region_kinds(regions, page_width=pw, page_height=ph)
        return regions, False, None

    if should_skip_before_vision(page_type):
        return [], True, classify_reason

    return [
        full_page_region(
            page.jpeg_bytes,
            source_page=page.page_number,
            detection_method=method,
        )
    ], False, None


def detect_document_regions(
    filename: str,
    file_bytes: bytes,
    pages: list[RasterizedPage],
    *,
    content_sha256: str,
) -> DocumentDetection:
    """Run Grounding DINO on every page and clip detected regions."""
    from uuid import uuid4

    is_pdf = filename.lower().endswith(".pdf")
    source_pages: list[SourcePageDetection] = []
    total_regions = 0
    detection_method = "grounding_dino"

    for page in pages:
        img = Image.open(io.BytesIO(page.jpeg_bytes))
        w, h = img.size

        regions, skipped, skip_reason = _regions_from_page(
            page, total_pages=len(pages)
        )

        if regions:
            detection_method = regions[0].detection_method
        total_regions += len(regions)

        source_pages.append(
            SourcePageDetection(
                page_number=page.page_number,
                page_width=w,
                page_height=h,
                regions=regions,
                skipped=skipped,
                skip_reason=skip_reason,
            )
        )

    return DocumentDetection(
        detection_id=str(uuid4()),
        filename=filename,
        content_sha256=content_sha256,
        document_type="pdf" if is_pdf else "image",
        source_page_count=len(pages),
        total_regions=total_regions,
        pages=source_pages,
        detection_method=detection_method if total_regions else "none",
    )


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
        skip_classifier=region.detection_method == "grounding_dino",
    )


def units_from_document_detection(
    detection: DocumentDetection,
    pages: list[RasterizedPage],
    *,
    excluded_region_ids: set[str] | None = None,
) -> list[AnalysisUnit]:
    """Build analysis units from a stored detection, skipping excluded regions."""
    excluded = excluded_region_ids or set()
    page_by_number = {p.page_number: p for p in pages}
    units: list[AnalysisUnit] = []
    plan_number = 0

    for source_page in detection.pages:
        if source_page.skipped:
            continue
        page = page_by_number.get(source_page.page_number)
        if page is None:
            continue

        for region in source_page.regions:
            if region.region_id in excluded:
                log.info(
                    "region_expander.exclude_region",
                    region_id=region.region_id,
                    source_page=source_page.page_number,
                )
                continue
            plan_number += 1
            units.append(_region_to_unit(region, page, plan_number))

    log.info(
        "region_expander.from_detection",
        detection_id=detection.detection_id,
        analysis_units=len(units),
        excluded=len(excluded),
    )
    return units


def expand_to_analysis_units(
    pages: list[RasterizedPage],
    *,
    total_pages: int | None = None,
    excluded_region_ids: set[str] | None = None,
) -> list[AnalysisUnit]:
    """Detect and clip floor plans on each page, then produce sequential analysis units."""
    total = total_pages or len(pages)
    excluded = excluded_region_ids or set()
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
            if region.region_id in excluded:
                continue
            plan_number += 1
            units.append(_region_to_unit(region, page, plan_number))

    log.info(
        "region_expander.complete",
        source_pages=len(pages),
        analysis_units=len(units),
    )
    return units
