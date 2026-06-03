from io import BytesIO
from pathlib import Path
import re

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from config.constants import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_PDF_PAGE_COUNT,
    MAX_UPLOAD_SIZE,
)


SUSPICIOUS_PDF_PATTERNS = [
    br"/JavaScript",
    br"/JS",
    br"/Launch",
    br"/EmbeddedFile",
    br"/RichMedia",
    br"/OpenAction",
    br"/AA",
]

SUSPICIOUS_IMAGE_PATTERNS = [
    br"MZ",
    br"PK\x03\x04",
    br"<script",
    br"javascript:",
]

FORMAT_EXTENSION_MAP = {
    "JPEG": {".jpg", ".jpeg"},
    "PNG": {".png"},
    "WEBP": {".webp"},
}


def _normalize_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def _is_pdf_bytes(file_bytes: bytes) -> bool:
    return file_bytes.lstrip().startswith(b"%PDF")


def validate_upload_file(file: UploadFile, file_bytes: bytes) -> None:
    filename = file.filename or ""
    ext = _normalize_extension(filename)
    mime_type = (file.content_type or "").lower()

    validate_file_size(file_bytes)
    validate_mime_and_extension(mime_type, ext, file_bytes)

    if ext == ".pdf" or _is_pdf_bytes(file_bytes):
        validate_pdf(file_bytes)
    else:
        validate_image(file_bytes, mime_type, ext)


def validate_mime_and_extension(mime_type: str, ext: str, file_bytes: bytes) -> None:
    if mime_type and mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported MIME type: {mime_type}")

    if ext and ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension: {ext}")

    if not mime_type and not ext and not file_bytes:
        raise ValueError("Missing file metadata and contents")

    if ext and ext == ".pdf" and mime_type and mime_type != "application/pdf":
        raise ValueError("PDF extension does not match MIME type")

    if ext and ext in {".jpg", ".jpeg"} and mime_type and mime_type not in {"image/jpeg"}:
        raise ValueError("JPEG extension does not match MIME type")

    if ext == ".png" and mime_type and mime_type != "image/png":
        raise ValueError("PNG extension does not match MIME type")

    if ext == ".webp" and mime_type and mime_type != "image/webp":
        raise ValueError("WEBP extension does not match MIME type")

    if not ext and _is_pdf_bytes(file_bytes) and mime_type not in {"application/pdf", ""}:
        raise ValueError("PDF contents do not match declared MIME type")


def validate_file_size(file_bytes: bytes) -> None:
    if len(file_bytes) == 0:
        raise ValueError("Uploaded file is empty")
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise ValueError(
            f"Uploaded file is too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
        )


def validate_pdf(file_bytes: bytes) -> None:
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except PdfReadError as exc:
        raise ValueError(f"Invalid PDF structure: {exc}") from exc
    except Exception as exc:
        raise ValueError(f"Invalid PDF structure: {exc}") from exc

    if reader.is_encrypted:
        raise ValueError("Password protected or encrypted PDF files are not supported")

    page_count = len(reader.pages)
    if page_count == 0:
        raise ValueError("PDF contains no pages")
    if page_count > MAX_PDF_PAGE_COUNT:
        raise ValueError(
            f"PDF exceeds maximum page count of {MAX_PDF_PAGE_COUNT}. Uploaded {page_count} pages."
        )

    run_malware_scan(file_bytes, is_pdf=True)


def validate_image(file_bytes: bytes, mime_type: str, ext: str) -> None:
    try:
        with Image.open(BytesIO(file_bytes)) as img:
            img.verify()
            image_format = img.format
    except UnidentifiedImageError as exc:
        raise ValueError("Image file is corrupted or not a supported image format") from exc
    except Exception as exc:
        raise ValueError(f"Image corruption check failed: {exc}") from exc

    if image_format not in FORMAT_EXTENSION_MAP:
        raise ValueError(f"Unsupported image format: {image_format}")

    if ext and ext not in FORMAT_EXTENSION_MAP[image_format]:
        raise ValueError(
            f"File extension {ext} does not match actual image format {image_format}"
        )

    run_malware_scan(file_bytes, is_pdf=False)


def run_malware_scan(file_bytes: bytes, is_pdf: bool) -> None:
    content = file_bytes if is_pdf else file_bytes.lower()
    patterns = SUSPICIOUS_PDF_PATTERNS if is_pdf else SUSPICIOUS_IMAGE_PATTERNS

    for pattern in patterns:
        if pattern in content:
            raise ValueError("Malware scan failed: suspicious file content detected")

    if not is_pdf and file_bytes.startswith(b"PK\x03\x04"):
        raise ValueError("Malware scan failed: image contains unexpected archive signature")
