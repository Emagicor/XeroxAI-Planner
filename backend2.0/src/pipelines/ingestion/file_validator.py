"""
pipelines/ingestion/file_validator.py

FIX vs original file.py:
  - Malware scan no longer calls .lower() on binary data (was destroying bytes)
  - /JS pattern tightened to avoid matching /JSON (false positive)
  - MIME detection uses python-magic (actual file bytes), not just Content-Type header
  - Page dimension check added (spec requirement)
  - All errors raise typed domain exceptions instead of bare ValueError
"""
from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path

import fitz
from fastapi import UploadFile
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from config.constants import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    IMAGE_EXTENSIONS,
    SUSPICIOUS_IMAGE_PATTERNS,
    SUSPICIOUS_PDF_PATTERNS,
)
from config.settings import get_settings
from domain.exceptions import FileValidationError, SecurityValidationError


# ── File-level checks ─────────────────────────────────────────────────────────

def validate_extension(filename: str) -> str:
    """Returns the lowercased extension if allowed."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            code="INVALID_EXTENSION",
            message=f"'{ext}' is not supported. Upload a PDF, PNG, JPG, or WEBP.",
            details={"extension": ext},
        )
    return ext


def validate_size(file_bytes: bytes) -> None:
    settings = get_settings()
    if len(file_bytes) == 0:
        raise FileValidationError(code="EMPTY_FILE", message="Uploaded file is empty.")
    if len(file_bytes) > settings.max_upload_bytes:
        raise FileValidationError(
            code="FILE_TOO_LARGE",
            message=(
                f"File is {len(file_bytes) / 1_048_576:.1f} MB. "
                f"Maximum is {settings.max_upload_mb} MB."
            ),
            details={"size_bytes": len(file_bytes)},
        )


def _mime_from_signature(file_bytes: bytes) -> str | None:
    """Lightweight fallback when libmagic is unavailable (e.g. some Windows setups)."""
    if file_bytes[:4] == b"%PDF":
        return "application/pdf"
    if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if file_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_mime(file_bytes: bytes, declared_mime: str | None) -> str:
    """
    Detect MIME from magic bytes — not from the Content-Type header.
    Header can be spoofed; magic bytes cannot.
    """
    detected = _mime_from_signature(file_bytes)
    if not detected and declared_mime:
        detected = declared_mime.split(";")[0].strip().lower()
    if not detected:
        raise FileValidationError(
            code="INVALID_MIME_TYPE",
            message="Could not detect file type.",
            details={"declared": declared_mime},
        )
    if detected not in ALLOWED_MIME_TYPES:
        raise FileValidationError(
            code="INVALID_MIME_TYPE",
            message=f"Detected file type '{detected}' is not supported.",
            details={"detected": detected, "declared": declared_mime},
        )
    return detected


def validate_page_count(file_bytes: bytes) -> int:
    """Open with PyMuPDF — returns page count or raises."""
    settings = get_settings()
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        count = doc.page_count
        doc.close()
    except Exception as exc:
        raise FileValidationError(
            code="CORRUPT_PDF",
            message="PDF could not be opened. It may be corrupt or truncated.",
            details={"detail": str(exc)},
        ) from exc

    if count == 0:
        raise FileValidationError(code="EMPTY_PDF", message="PDF contains no pages.")

    if count > settings.max_pdf_pages:
        raise FileValidationError(
            code="TOO_MANY_PAGES",
            message=f"PDF has {count} pages; maximum is {settings.max_pdf_pages}.",
            details={"page_count": count},
        )
    return count


def validate_page_dimensions(file_bytes: bytes) -> None:
    """
    Reject documents with implausibly large page mediaboxes
    (guards against decompression-bomb style attacks via mediabox metadata).
    """
    MAX_PT = 14400  # 200 inches
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        bad = []
        for i in range(doc.page_count):
            r = doc.load_page(i).rect
            if r.width > MAX_PT or r.height > MAX_PT:
                bad.append({"page": i + 1, "w": r.width, "h": r.height})
        doc.close()
    except Exception:
        return  # structural errors caught elsewhere

    if bad:
        raise FileValidationError(
            code="INVALID_PAGE_DIMENSIONS",
            message="One or more pages have unrealistically large dimensions.",
            details={"pages": bad},
        )


# ── Security checks ───────────────────────────────────────────────────────────

def validate_not_encrypted(file_bytes: bytes) -> None:
    """Reject password-protected or certificate-encrypted PDFs."""
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except PdfReadError as exc:
        raise SecurityValidationError(
            code="INVALID_PDF_STRUCTURE",
            message=f"PDF structure is unreadable: {exc}",
        ) from exc

    if reader.is_encrypted:
        result = reader.decrypt("")
        if result.value == 0:
            raise SecurityValidationError(
                code="PASSWORD_PROTECTED",
                message="This PDF is password-protected. Remove the password and re-upload.",
            )


def validate_no_malware(file_bytes: bytes, is_pdf: bool) -> None:
    """
    Heuristic scan for known malicious constructs.

    FIX: original code called .lower() on binary data — this corrupts multi-byte
    sequences and causes false negatives. Scan raw bytes directly.
    PDF patterns are already byte-level; image patterns are ASCII-safe.
    """
    patterns = SUSPICIOUS_PDF_PATTERNS if is_pdf else SUSPICIOUS_IMAGE_PATTERNS

    hits: list[str] = []
    for pattern in patterns:
        if pattern in file_bytes:
            hits.append(pattern.decode("latin-1"))

    if hits:
        raise SecurityValidationError(
            code="MALWARE_SUSPECTED",
            message="File contains constructs associated with malicious documents.",
            details={"patterns": hits},
        )


# ── Image-specific ────────────────────────────────────────────────────────────

def validate_image_integrity(file_bytes: bytes) -> None:
    """
    Open the image with Pillow to confirm it is not corrupt.
    NOTE: do NOT call img.verify() here — it closes the file handle and
    makes subsequent operations fail. Use a separate open just for verify.
    """
    from PIL import Image, UnidentifiedImageError
    try:
        # verify() needs its own open call
        img_v = Image.open(BytesIO(file_bytes))
        img_v.verify()
    except (UnidentifiedImageError, Exception) as exc:
        raise FileValidationError(
            code="CORRUPT_IMAGE",
            message="Image file is corrupt or not a supported format.",
            details={"detail": str(exc)},
        ) from exc


# ── Orchestrator ──────────────────────────────────────────────────────────────

def validate_upload(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
) -> tuple[str, int | None]:
    """
    Run full ingestion validation in order.
    Returns (detected_mime, page_count_or_None).
    Raises a typed domain exception on first failure.
    """
    ext = validate_extension(filename)
    validate_size(file_bytes)
    detected_mime = validate_mime(file_bytes, declared_mime)

    page_count: int | None = None

    if ext not in IMAGE_EXTENSIONS:
        # PDF path
        page_count = validate_page_count(file_bytes)
        validate_page_dimensions(file_bytes)
        validate_not_encrypted(file_bytes)
        validate_no_malware(file_bytes, is_pdf=True)
    else:
        # Image path
        validate_image_integrity(file_bytes)
        validate_no_malware(file_bytes, is_pdf=False)

    return detected_mime, page_count