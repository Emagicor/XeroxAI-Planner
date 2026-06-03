"""
application/orchestrators/analyze_orchestrator.py

Orchestrates the full pipeline for a single uploaded document:
  1. Validate upload
  2. Rasterize (PDF → JPEG pages, or wrap single image)
  3. Classify each page
  4. Extract + analyze each floorplan page
  5. Aggregate results
  6. Return AnalyzeJob

This is the single entry point called by the API route.
It does not know about HTTP — it only speaks domain types.
"""
from __future__ import annotations

import structlog

from domain.entities.job import AnalyzeJob, DimensionSource, PageResult, PageType, RoomResult
from domain.exceptions import ZeroxError
from infrastructure.rasterizer.pdf_rasterizer import rasterize_pdf, rasterize_single_image
from pipelines.extraction.page_analyzer import analyze_page_safe
from pipelines.ingestion.file_validator import validate_upload
from pipelines.processing.page_classifier import classify_page
from application.use_cases.job_store import save_job
from providers.vision.factory import get_vision_provider

log = structlog.get_logger(__name__)


def run_analyze_pipeline(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
) -> AnalyzeJob:
    """
    Full synchronous pipeline.
    Returns a completed (or failed) AnalyzeJob.
    Never raises — failures are captured in job.error_*.
    """
    job = AnalyzeJob(filename=filename, file_size_bytes=len(file_bytes))
    log.info("pipeline.start", job_id=job.job_id, filename=filename)

    try:
        # ── Layer 1: Ingestion ────────────────────────────────────────────────
        job.mark_ingesting()
        detected_mime, page_count = validate_upload(filename, file_bytes, declared_mime)
        log.info("pipeline.ingestion_ok", job_id=job.job_id, page_count=page_count)

        # ── Layer 2: Rasterize ────────────────────────────────────────────────
        if detected_mime == "application/pdf":
            pages = rasterize_pdf(file_bytes)
        else:
            pages = rasterize_single_image(file_bytes, detected_mime)

        job.mark_processing(len(pages))

        # ── Layer 3–7: Extract + compute per page ─────────────────────────────
        job.mark_extracting()
        provider = get_vision_provider()

        for idx, (img_bytes, mime) in enumerate(pages, start=1):
            job.advance_page(idx)
            log.info("pipeline.page_start", job_id=job.job_id, page=idx, total=len(pages))

            page_type = classify_page(img_bytes, idx)

            # Skip non-floorplan pages — mark ineligible with reason
            if page_type not in (PageType.FLOORPLAN, PageType.UNKNOWN):
                page_result = PageResult(
                    page_number=idx,
                    page_type=page_type,
                    eligible=False,
                    ineligible_reason=f"Page type '{page_type.value}' is not a floor plan.",
                )
                job.pages.append(page_result)
                continue

            # Extract rooms from this page
            raw = analyze_page_safe(provider, img_bytes, mime, page_number=idx)
            page_result = _build_page_result(idx, page_type, raw)
            job.pages.append(page_result)

        # ── Finalise ──────────────────────────────────────────────────────────
        job.mark_computing()
        job.mark_complete()
        log.info(
            "pipeline.complete",
            job_id=job.job_id,
            grand_total=job.grand_total_sqft,
            eligible=len(job.eligible_pages),
            ineligible=len(job.ineligible_pages),
        )

    except ZeroxError as exc:
        job.mark_failed(exc.code, exc.message)
        log.error("pipeline.domain_error", job_id=job.job_id, code=exc.code, msg=exc.message)

    except Exception as exc:
        job.mark_failed("INTERNAL_ERROR", str(exc))
        log.error("pipeline.unexpected_error", job_id=job.job_id, error=str(exc), exc_info=True)

    save_job(job)
    return job


# ── Mapping helpers ───────────────────────────────────────────────────────────

def _build_page_result(page_number: int, page_type: PageType, raw: dict) -> PageResult:
    """Convert raw vision-model dict into a typed PageResult."""

    if not raw.get("eligible", True):
        return PageResult(
            page_number=page_number,
            page_type=page_type,
            eligible=False,
            ineligible_reason=raw.get("reason", "Extraction failed"),
        )

    rooms: list[RoomResult] = [_build_room(r) for r in (raw.get("rooms") or [])]

    page = PageResult(
        page_number=page_number,
        page_type=page_type,
        eligible=True,
        rooms=rooms,
        total_area_sqft=float(raw.get("total_area_sqft") or 0),
        total_area_source=raw.get("total_area_source", "room_sum"),
        layout_dimensions_used=raw.get("layout_dimensions_used"),
        overall_confidence=int(raw.get("overall_confidence") or 0),
        units_detected=raw.get("units_detected", "feet"),
        annotated_image=raw.get("annotated_image"),
    )
    page.compute_totals()
    return page


def _build_room(r: dict) -> RoomResult:
    source_str = r.get("dimension_source", "assumed")
    try:
        source = DimensionSource(source_str)
    except ValueError:
        source = DimensionSource.ASSUMED

    return RoomResult(
        name=r.get("name", "Unknown"),
        bbox=r.get("bbox", [0, 0, 0, 0]),
        polygon=r.get("polygon", []),
        length_ft=r.get("length_ft"),
        width_ft=r.get("width_ft"),
        area_sqft=r.get("area_sqft"),
        confidence_pct=int(r.get("confidence_pct") or 0),
        dimension_source=source,
        assumptions=r.get("assumptions") or [],
    )