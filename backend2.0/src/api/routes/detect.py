"""POST /detect — Grounding DINO floor plan detection + clip previews."""
from __future__ import annotations

import asyncio
import base64

import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from api.schemas.detect import (
    DetectResponseSchema,
    DetectedRegionSchema,
    RegionBBoxSchema,
    SourcePageSchema,
)
from application.orchestrators.detect_orchestrator import run_detect_pipeline
from infrastructure.preprocessing.image_preprocessor import prepare_ui_preview_image
from domain.entities.detection import DocumentDetection
from engines.detection.floor_plan_detector import model_status
from pipelines.ingestion.file_validator import validate_upload

log = structlog.get_logger(__name__)
router = APIRouter()


def _infer_scenario(detection: DocumentDetection) -> str:
    pages = detection.source_page_count
    regions = detection.total_regions
    is_pdf = detection.document_type == "pdf"

    if not is_pdf and pages == 1 and regions == 1:
        return "single_image_single_floorplan"
    if is_pdf and pages == 1 and regions == 1:
        return "single_pdf_single_page"
    if not is_pdf and pages == 1 and regions > 1:
        return "single_image_multi_floorplan"
    if is_pdf and pages > 1 and all(len(p.regions) <= 1 for p in detection.pages):
        return "single_pdf_multi_page"
    if is_pdf and pages > 1 and any(len(p.regions) > 1 for p in detection.pages):
        return "single_pdf_multi_page_multi_floorplan"
    return "mixed"


def _to_response(detection: DocumentDetection) -> dict:
    status = model_status()
    from_pdf = detection.document_type == "pdf"
    pages = []
    for page in detection.pages:
        regions = []
        for r in page.regions:
            preview_bytes, _ = prepare_ui_preview_image(
                r.jpeg_bytes,
                from_pdf=from_pdf,
            )
            regions.append(
                DetectedRegionSchema(
                    region_id=r.region_id,
                    region_index=r.region_index,
                    label=r.label,
                    confidence=round(r.confidence, 4),
                    bbox=RegionBBoxSchema(
                        x1=r.bbox.x1,
                        y1=r.bbox.y1,
                        x2=r.bbox.x2,
                        y2=r.bbox.y2,
                    ),
                    preview_image=base64.b64encode(preview_bytes).decode("ascii"),
                    detection_method=r.detection_method,
                    region_kind=r.region_kind,
                    suggested_exclude=r.suggested_exclude,
                )
            )
        page_preview = None
        if page.page_preview_bytes:
            preview_bytes, _ = prepare_ui_preview_image(
                page.page_preview_bytes,
                from_pdf=True,
            )
            page_preview = base64.b64encode(preview_bytes).decode("ascii")

        pages.append(
            SourcePageSchema(
                page_number=page.page_number,
                page_width=page.page_width,
                page_height=page.page_height,
                regions=regions,
                skipped=page.skipped,
                skip_reason=page.skip_reason,
                page_preview_image=page_preview,
            )
        )

    payload = DetectResponseSchema(
        detection_id=detection.detection_id,
        filename=detection.filename,
        content_sha256=detection.content_sha256,
        document_type=detection.document_type,
        source_page_count=detection.source_page_count,
        total_regions=detection.total_regions,
        pages=pages,
        detection_method=detection.detection_method,
        model_available=status["available"],
        model_error=status.get("error"),
        scenario=_infer_scenario(detection),
    ).model_dump(mode="json")

    return payload


async def _read_upload(file: UploadFile) -> tuple[bytes, str, str]:
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    filename = file.filename or "upload"
    mime = (file.content_type or "").lower()
    return file_bytes, filename, mime


@router.post("/detect")
async def detect_floor_plans(file: UploadFile = File(...)):
    """
    Detect and clip floor plan regions from an uploaded image or PDF.

    Returns clipped JPEG previews per region. Call POST /analyze afterward to measure rooms.
    """
    file_bytes, filename, mime = await _read_upload(file)

    try:
        detection = await asyncio.to_thread(
            run_detect_pipeline, filename, file_bytes, mime
        )
    except Exception as exc:
        from domain.exceptions import ZeroxError

        if isinstance(exc, ZeroxError):
            raise HTTPException(
                status_code=422,
                detail={"code": exc.code, "message": exc.message},
            ) from exc
        log.error("detect.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JSONResponse(content=_to_response(detection))
