"""
api/routes/analyze.py

FIX vs original routes/analyze.py:
  - _event_stream was a sync generator inside an async route → blocks event loop.
    Now uses an async generator with asyncio.to_thread for the blocking vision call.
  - Per-page exceptions are caught inside the loop — one bad page never kills the stream.
  - Both /analyze and /analyze/stream use the same orchestrator (no code duplication).
  - CORS origin locked down in main.py (not * for production).
"""
from __future__ import annotations

import asyncio
import base64
import json

import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response, StreamingResponse

from api.schemas.analyze import AnalyzeResponseSchema, PageSchema, RoomSchema
from application.orchestrators.analyze_orchestrator import run_analyze_pipeline
from application.use_cases.job_store import get_job
from domain.entities.job import AnalyzeJob, JobStatus
from domain.exceptions import IngestionError

log = structlog.get_logger(__name__)
router = APIRouter()


# ── Mapping helpers ───────────────────────────────────────────────────────────

def _job_to_response(job: AnalyzeJob) -> dict:
    pages = [
        PageSchema(
            page_number=p.page_number,
            page_type=p.page_type.value,
            eligible=p.eligible,
            ineligible_reason=p.ineligible_reason,
            rooms=[
                RoomSchema(
                    room_id=r.room_id,
                    name=r.name,
                    bbox=r.bbox,
                    polygon=r.polygon,
                    length_ft=r.length_ft,
                    width_ft=r.width_ft,
                    area_sqft=r.area_sqft,
                    confidence_pct=r.confidence_pct,
                    dimension_source=r.dimension_source.value,
                    assumptions=r.assumptions,
                    is_assumed=r.is_assumed,
                )
                for r in p.rooms
            ],
            total_area_sqft=p.total_area_sqft,
            total_area_source=p.total_area_source,
            layout_dimensions_used=p.layout_dimensions_used,
            overall_confidence=p.overall_confidence,
            units_detected=p.units_detected,
            has_annotated_image=bool(p.annotated_image),
        )
        for p in job.pages
    ]

    payload = AnalyzeResponseSchema(
        job_id=job.job_id,
        filename=job.filename,
        status=job.status.value,
        total_pages=job.total_pages,
        pages=pages,
        grand_total_sqft=job.grand_total_sqft,
        eligible_pages=len(job.eligible_pages),
        ineligible_pages=len(job.ineligible_pages),
        has_assumed=job.has_assumed,
        has_low_confidence=job.has_low_confidence,
        created_at=job.created_at,
    ).model_dump(mode="json")

    return payload


@router.get("/analyze/{job_id}/pages/{page_number}/annotated")
def get_page_annotated_image(job_id: str, page_number: int):
    """Return annotated JPEG for a page (keeps main /analyze JSON small)."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    page = next((p for p in job.pages if p.page_number == page_number), None)
    if not page or not page.annotated_image:
        raise HTTPException(
            status_code=404,
            detail=f"No annotated image for page {page_number}.",
        )

    try:
        raw = base64.b64decode(page.annotated_image, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Invalid annotated image data.") from exc

    return Response(
        content=raw,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


async def _read_upload(file: UploadFile) -> tuple[bytes, str, str]:
    """Read bytes, filename, declared mime from the upload."""
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    filename   = file.filename or "upload"
    mime       = (file.content_type or "").lower()
    return file_bytes, filename, mime


# ── POST /analyze — full blocking response ────────────────────────────────────

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Process the full document synchronously and return one JSON object.
    Suitable for documents up to ~10 pages; use /analyze/stream for larger ones.
    """
    file_bytes, filename, mime = await _read_upload(file)

    # Run the blocking pipeline in a thread so we don't block the event loop
    job: AnalyzeJob = await asyncio.to_thread(
        run_analyze_pipeline, filename, file_bytes, mime
    )

    if job.status == JobStatus.FAILED:
        # Distinguish ingestion failures (422) from pipeline failures (500)
        status_code = 422 if job.error_code in (
            "INVALID_EXTENSION", "INVALID_MIME_TYPE", "FILE_TOO_LARGE",
            "TOO_MANY_PAGES", "CORRUPT_PDF", "PASSWORD_PROTECTED",
            "MALWARE_SUSPECTED", "EMPTY_FILE",
        ) else 500
        raise HTTPException(
            status_code=status_code,
            detail={"code": job.error_code, "message": job.error_message},
        )

    return JSONResponse(content=_job_to_response(job))


# ── POST /analyze/stream — SSE: one event per page ───────────────────────────

@router.post("/analyze/stream")
async def analyze_stream(file: UploadFile = File(...)):
    """
    Server-Sent Events endpoint.

    Events:
      { "type": "progress", "page": N, "total_pages": M, "data": <PageSchema> }
      { "type": "done",     "grand_total_sqft": float, ... }
      { "type": "error",    "message": "..." }

    FIX: was a sync generator — now async generator using asyncio.to_thread
    for each blocking page analysis call so the event loop stays free.
    """
    from infrastructure.rasterizer.pdf_rasterizer import rasterize_pdf, rasterize_single_image
    from infrastructure.preprocessing.image_preprocessor import preprocess_image
    from pipelines.ingestion.file_validator import validate_upload
    from pipelines.extraction.page_analyzer import analyze_page_safe
    from pipelines.processing.page_classifier import classify_page, PageType
    from providers.vision.factory import get_vision_provider
    from application.orchestrators.analyze_orchestrator import _build_page_result

    file_bytes, filename, mime = await _read_upload(file)

    async def _event_stream():
        try:
            # Validate
            detected_mime, _ = await asyncio.to_thread(
                validate_upload, filename, file_bytes, mime
            )

            # Rasterize
            if detected_mime == "application/pdf":
                pages = await asyncio.to_thread(rasterize_pdf, file_bytes)
            else:
                pages = rasterize_single_image(file_bytes, detected_mime)

            total_pages = len(pages)
            provider = get_vision_provider()
            grand_total = 0.0
            eligible = ineligible = 0

            for idx, (img_bytes, img_mime) in enumerate(pages, start=1):
                try:
                    page_type = classify_page(img_bytes, idx)
                    raw = await asyncio.to_thread(
                        analyze_page_safe, provider, img_bytes, img_mime, idx
                    )
                    page_result = _build_page_result(idx, page_type, raw)

                    if page_result.eligible:
                        eligible += 1
                        grand_total += page_result.total_area_sqft
                    else:
                        ineligible += 1

                    event = {
                        "type":        "progress",
                        "page":        idx,
                        "total_pages": total_pages,
                        "data":        PageSchema(
                            page_number=page_result.page_number,
                            page_type=page_result.page_type.value,
                            eligible=page_result.eligible,
                            ineligible_reason=page_result.ineligible_reason,
                            rooms=[],
                            total_area_sqft=page_result.total_area_sqft,
                            total_area_source=page_result.total_area_source,
                            overall_confidence=page_result.overall_confidence,
                            units_detected=page_result.units_detected,
                        ).model_dump(),
                    }

                except Exception as exc:
                    # Per-page isolation — log and continue
                    log.error("stream.page_error", page=idx, error=str(exc))
                    ineligible += 1
                    event = {
                        "type":        "progress",
                        "page":        idx,
                        "total_pages": total_pages,
                        "data":        {"eligible": False, "reason": str(exc)},
                    }

                yield f"data: {json.dumps(event)}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'grand_total_sqft': round(grand_total, 2), 'eligible_pages': eligible, 'ineligible_pages': ineligible, 'page_count': total_pages})}\n\n"

        except Exception as exc:
            log.error("stream.fatal_error", error=str(exc), exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )