"""Orchestrates floor-plan detection (Grounding DINO + clip) for uploaded documents."""
from __future__ import annotations

import hashlib

import structlog

from application.use_cases.detection_store import save_detection
from domain.entities.detection import DocumentDetection
from domain.exceptions import ZeroxError
from infrastructure.rasterizer.pdf_rasterizer import rasterize_pdf, rasterize_single_image
from pipelines.ingestion.file_validator import validate_upload
from pipelines.processing.region_expander import detect_document_regions

log = structlog.get_logger(__name__)


def run_detect_pipeline(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
) -> DocumentDetection:
    file_bytes = bytes(file_bytes)
    content_sha256 = hashlib.sha256(file_bytes).hexdigest()

    log.info("detect.start", filename=filename, content_sha256=content_sha256[:16])

    detected_mime, _ = validate_upload(filename, file_bytes, declared_mime)

    if detected_mime == "application/pdf":
        pages = rasterize_pdf(file_bytes)
    else:
        pages = rasterize_single_image(file_bytes, detected_mime)

    detection = detect_document_regions(
        filename,
        file_bytes,
        pages,
        content_sha256=content_sha256,
    )

    save_detection(detection)
    log.info(
        "detect.complete",
        detection_id=detection.detection_id,
        source_pages=detection.source_page_count,
        total_regions=detection.total_regions,
    )
    return detection
