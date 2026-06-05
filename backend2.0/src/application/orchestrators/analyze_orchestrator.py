"""
application/orchestrators/analyze_orchestrator.py

Orchestrates the full pipeline for a single uploaded document.
"""
from __future__ import annotations

import hashlib
import structlog

from domain.entities.job import AnalyzeJob
from domain.exceptions import ZeroxError
from infrastructure.rasterizer.pdf_rasterizer import rasterize_pdf, rasterize_single_image
from pipelines.processing.page_processor import process_rasterized_page
from pipelines.ingestion.file_validator import validate_upload
from application.use_cases.job_store import save_job

log = structlog.get_logger(__name__)

_PROVIDER_FAILURE_MARKERS = (
    "gemini",
    "openai",
    "provider",
    "api_key",
    "quota",
    "rate limit",
    "429",
    "503",
    "missing_api_key",
    "json_parse_error",
)


def _looks_like_provider_failure(reason: str) -> bool:
    lower = reason.lower()
    return any(marker in lower for marker in _PROVIDER_FAILURE_MARKERS)


def _finalize_job_status(job: AnalyzeJob) -> None:
    """Complete when at least one page succeeded; fail when every page hit the provider."""
    if job.eligible_pages:
        job.mark_complete()
        return

    reasons = [p.ineligible_reason for p in job.pages if p.ineligible_reason]
    if reasons and all(_looks_like_provider_failure(r) for r in reasons):
        first = reasons[0]
        code = "QUOTA_EXCEEDED" if "quota" in first.lower() else "VISION_PROVIDER_ERROR"
        job.mark_failed(code, first[:500])
        return

    job.mark_complete()


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
    file_bytes = bytes(file_bytes)
    content_sha256 = hashlib.sha256(file_bytes).hexdigest()

    job = AnalyzeJob(
        filename=filename,
        file_size_bytes=len(file_bytes),
        content_sha256=content_sha256,
    )
    session_id = job.job_id

    log.info(
        "pipeline.start",
        job_id=session_id,
        filename=filename,
        content_sha256=content_sha256[:16],
    )

    try:
        job.mark_ingesting()
        detected_mime, page_count = validate_upload(filename, file_bytes, declared_mime)
        log.info("pipeline.ingestion_ok", job_id=session_id, page_count=page_count)

        if detected_mime == "application/pdf":
            pages = rasterize_pdf(file_bytes)
        else:
            pages = rasterize_single_image(file_bytes, detected_mime)

        job.mark_processing(len(pages))
        job.mark_extracting()

        for page in pages:
            job.advance_page(page.page_number)
            log.info(
                "pipeline.page_start",
                job_id=session_id,
                page=page.page_number,
                total=len(pages),
            )

            page_result = process_rasterized_page(
                page,
                len(pages),
                session_id=session_id,
            )
            job.pages.append(page_result)

        job.mark_computing()
        _finalize_job_status(job)
        log.info(
            "pipeline.complete",
            job_id=session_id,
            grand_total=job.grand_total_sqft,
            eligible=len(job.eligible_pages),
            ineligible=len(job.ineligible_pages),
            content_sha256=content_sha256[:16],
        )

    except ZeroxError as exc:
        job.mark_failed(exc.code, exc.message)
        log.error("pipeline.domain_error", job_id=session_id, code=exc.code, msg=exc.message)

    except Exception as exc:
        job.mark_failed("INTERNAL_ERROR", str(exc))
        log.error("pipeline.unexpected_error", job_id=session_id, error=str(exc), exc_info=True)

    save_job(job)
    return job
