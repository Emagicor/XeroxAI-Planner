from __future__ import annotations

import json

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from image.pdf import convert_pdf_to_jpegs
from services.analysis import analyze_pages, _try_analyze_single_page
from validators.file import validate_upload_file

analyze_router = APIRouter()


def _is_pdf(file: UploadFile, file_bytes: bytes) -> bool:
    mime_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    return (
        mime_type == "application/pdf"
        or filename.endswith(".pdf")
        or file_bytes.lstrip().startswith(b"%PDF")
    )


# ── /analyze  ── full blocking response (all pages, one JSON) ────────────────

@analyze_router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_bytes = await file.read()
    try:
        validate_upload_file(file, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if _is_pdf(file, file_bytes):
        try:
            pages = convert_pdf_to_jpegs(file_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"PDF conversion failed: {exc}"
            ) from exc
    else:
        # Single image → treat as one page
        mime_type = file.content_type or "image/jpeg"
        pages = [(file_bytes, mime_type)]

    try:
        result = analyze_pages(pages)
        return JSONResponse(content=result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── /analyze/stream ── SSE: emits one JSON event per page as it finishes ─────

@analyze_router.post("/analyze/stream")
async def analyze_stream(file: UploadFile = File(...)):
    """
    Server-Sent Events endpoint.

    Each event is a JSON-encoded object:
      { "type": "progress", "page": N, "total_pages": M, "data": <page_result> }
    Final event:
      { "type": "done", "grand_total_sqft": float, "eligible_pages": int, "ineligible_pages": int }
    Error event:
      { "type": "error", "message": "..." }
    """
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_bytes = await file.read()
    try:
        validate_upload_file(file, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if _is_pdf(file, file_bytes):
        try:
            pages = convert_pdf_to_jpegs(file_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"PDF conversion failed: {exc}"
            ) from exc
    else:
        mime_type = file.content_type or "image/jpeg"
        pages = [(file_bytes, mime_type)]

    total_pages = len(pages)

    def _event_stream():
        grand_total = 0.0
        eligible = 0
        ineligible = 0

        for idx, (image_bytes, mime_type) in enumerate(pages, start=1):
            page_data = _try_analyze_single_page(image_bytes, mime_type)
            page_data["page"] = idx
            if "eligible" not in page_data:
                page_data["eligible"] = True

            if page_data.get("eligible", True):
                eligible += 1
                grand_total += float(page_data.get("total_area_sqft") or 0)
            else:
                ineligible += 1

            event = {
                "type": "progress",
                "page": idx,
                "total_pages": total_pages,
                "data": page_data,
            }
            yield f"data: {json.dumps(event)}\n\n"

        done = {
            "type": "done",
            "grand_total_sqft": round(grand_total, 2),
            "eligible_pages": eligible,
            "ineligible_pages": ineligible,
            "page_count": total_pages,
        }
        yield f"data: {json.dumps(done)}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )