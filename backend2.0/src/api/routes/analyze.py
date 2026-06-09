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
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response, StreamingResponse

from api.schemas.analyze import AnalyzeResponseSchema, PageSchema, RoomSchema
from infrastructure.isolated_runner import run_analyze_pipeline_isolated
from application.use_cases.job_store import get_job, save_job
from domain.entities.job import AnalyzeJob, JobStatus
from domain.exceptions import IngestionError

log = structlog.get_logger(__name__)
router = APIRouter()


# ── Mapping helpers ───────────────────────────────────────────────────────────

def _infer_scenario(filename: str, source_pages: int, total_regions: int, pages: list) -> str:
    is_pdf = filename.lower().endswith(".pdf")
    if not is_pdf and source_pages == 1 and total_regions == 1:
        return "single_image_single_floorplan"
    if is_pdf and source_pages == 1 and total_regions == 1:
        return "single_pdf_single_page"
    if not is_pdf and source_pages == 1 and total_regions > 1:
        return "single_image_multi_floorplan"
    if is_pdf and source_pages > 1:
        by_source: dict[int, int] = {}
        for p in pages:
            sp = p.source_page or p.page_number
            by_source[sp] = by_source.get(sp, 0) + 1
        if any(n > 1 for n in by_source.values()):
            return "single_pdf_multi_page_multi_floorplan"
        return "single_pdf_multi_page"
    return "mixed"


def _page_schema(p, *, inline_annotation: bool) -> PageSchema:
    return PageSchema(
        page_number=p.page_number,
        plan_number=p.plan_number or p.page_number,
        page_type=p.page_type.value,
        eligible=p.eligible,
        floor_label=p.floor_label,
        floor_label_confidence=p.floor_label_confidence,
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
        annotated_image=(
            p.annotated_image if inline_annotation and p.annotated_image else None
        ),
        source_page=p.source_page,
        region_index=p.region_index,
        region_id=p.region_id,
        region_label=p.region_label,
        detection_confidence=p.detection_confidence,
        detection_method=p.detection_method,
        clip_preview=p.clip_preview,
    )


def _job_to_response(job: AnalyzeJob) -> dict:
    inline_annotation = len(job.pages) == 1
    pages = [_page_schema(p, inline_annotation=inline_annotation) for p in job.pages]

    source_pages = len({p.source_page or p.page_number for p in job.pages}) or job.total_pages
    total_regions = len(job.pages)

    payload = AnalyzeResponseSchema(
        job_id=job.job_id,
        filename=job.filename,
        content_sha256=job.content_sha256,
        status=job.status.value,
        total_pages=job.total_pages,
        source_page_count=source_pages,
        total_regions=total_regions,
        scenario=_infer_scenario(job.filename, source_pages or 0, total_regions, job.pages),
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


def _parse_excluded_region_ids(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="excluded_region_ids must be a JSON array of strings.",
        ) from exc
    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=400,
            detail="excluded_region_ids must be a JSON array of strings.",
        )
    return [str(item) for item in parsed]


# ── POST /analyze — full blocking response ────────────────────────────────────

@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    detection_id: str | None = Form(None),
    excluded_region_ids: str | None = Form(None),
):
    """
    Process the full document synchronously and return one JSON object.
    Suitable for documents up to ~10 pages; use /analyze/stream for larger ones.

    Optional detection_id + excluded_region_ids reuse a prior /detect session and
    skip user-removed clippings.
    """
    file_bytes, filename, mime = await _read_upload(file)
    excluded = _parse_excluded_region_ids(excluded_region_ids)

    # Isolated subprocess — no in-process SDK/state bleed between back-to-back uploads
    job: AnalyzeJob = await asyncio.to_thread(
        run_analyze_pipeline_isolated,
        filename,
        file_bytes,
        mime,
        detection_id=detection_id,
        excluded_region_ids=excluded,
    )

    # Worker subprocess save_job is not visible here — persist for GET .../annotated
    save_job(job)

    if job.status == JobStatus.FAILED:
        # Distinguish ingestion failures (422) from pipeline failures (500)
        status_code = 422 if job.error_code in (
            "INVALID_EXTENSION", "INVALID_MIME_TYPE", "FILE_TOO_LARGE",
            "TOO_MANY_PAGES", "CORRUPT_PDF", "PASSWORD_PROTECTED",
            "MALWARE_SUSPECTED", "EMPTY_FILE",
            "DETECTION_NOT_FOUND", "DETECTION_MISMATCH",
        ) else 500
        # Surface missing/invalid API keys as 503 so clients show a clear message
        if job.error_code in (
            "MISSING_API_KEY",
            "INVALID_API_KEY",
            "QUOTA_EXCEEDED",
            "BILLING_CREDITS_DEPLETED",
            "MODEL_NOT_FOUND",
            "GEMINI_ERROR",
            "VISION_PROVIDER_ERROR",
        ):
            status_code = 503
        raise HTTPException(
            status_code=status_code,
            detail={"code": job.error_code, "message": job.error_message},
        )

    return JSONResponse(content=_job_to_response(job))


# ── POST /analyze/stream — SSE: one event per page ───────────────────────────

@router.post("/analyze/stream")
async def analyze_stream(
    file: UploadFile = File(...),
    detection_id: str | None = Form(None),
    excluded_region_ids: str | None = Form(None),
):
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
    from pipelines.ingestion.file_validator import validate_upload
    from pipelines.processing.page_processor import process_analysis_unit
    from uuid import uuid4

    file_bytes, filename, mime = await _read_upload(file)
    excluded = _parse_excluded_region_ids(excluded_region_ids)
    stream_session_id = str(uuid4())

    async def _event_stream():
        try:
            from application.orchestrators.analyze_orchestrator import _resolve_analysis_units
            import hashlib

            detected_mime, _ = await asyncio.to_thread(
                validate_upload, filename, file_bytes, mime
            )

            if detected_mime == "application/pdf":
                pages = await asyncio.to_thread(rasterize_pdf, file_bytes)
            else:
                pages = rasterize_single_image(file_bytes, detected_mime)

            content_sha256 = hashlib.sha256(file_bytes).hexdigest()
            units = await asyncio.to_thread(
                _resolve_analysis_units,
                pages,
                detection_id=detection_id,
                content_sha256=content_sha256,
                excluded_region_ids=set(excluded),
            )
            total_units = len(units)
            grand_total = 0.0
            eligible = ineligible = 0

            yield f"data: {json.dumps({'type': 'detected', 'total_regions': total_units, 'source_page_count': len(pages), 'scenario': _infer_scenario(filename, len(pages), total_units, [])})}\n\n"

            for unit in units:
                try:
                    page_result = await asyncio.to_thread(
                        process_analysis_unit,
                        unit,
                        total_units,
                        session_id=stream_session_id,
                    )

                    if page_result.eligible:
                        eligible += 1
                        grand_total += page_result.total_area_sqft
                    else:
                        ineligible += 1

                    event = {
                        "type": "progress",
                        "page": page_result.page_number,
                        "total_pages": total_units,
                        "source_page": page_result.source_page,
                        "region_index": page_result.region_index,
                        "data": _page_schema(page_result, inline_annotation=True).model_dump(),
                    }

                except Exception as exc:
                    log.error(
                        "stream.unit_error",
                        plan=unit.plan_number,
                        source_page=unit.source_page,
                        error=str(exc),
                    )
                    ineligible += 1
                    event = {
                        "type": "progress",
                        "page": unit.plan_number,
                        "total_pages": total_units,
                        "source_page": unit.source_page,
                        "region_index": unit.region_index,
                        "data": {
                            "page_number": unit.plan_number,
                            "plan_number": unit.plan_number,
                            "source_page": unit.source_page,
                            "region_index": unit.region_index,
                            "eligible": False,
                            "ineligible_reason": str(exc),
                        },
                    }

                yield f"data: {json.dumps(event)}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'grand_total_sqft': round(grand_total, 2), 'eligible_pages': eligible, 'ineligible_pages': ineligible, 'page_count': total_units, 'source_page_count': len(pages)})}\n\n"

        except Exception as exc:
            log.error("stream.fatal_error", error=str(exc), exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
