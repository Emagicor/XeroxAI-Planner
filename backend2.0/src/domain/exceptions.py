"""
Domain exceptions.

Hierarchy:
  ZeroxError                      ← base
  ├── IngestionError              ← upload rejected before job creation
  │   ├── FileValidationError
  │   ├── SecurityValidationError
  │   └── DocumentValidationError
  ├── PipelineError               ← job created but processing failed
  │   ├── RasterizationError
  │   ├── ExtractionError
  │   └── ProviderError           ← vision API call failed
  └── ExportError
"""
from __future__ import annotations


class ZeroxError(Exception):
    """Base for all application exceptions."""
    def __init__(self, code: str, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details: dict = details or {}


# ── Ingestion ─────────────────────────────────────────────────────────────────

class IngestionError(ZeroxError):
    """Upload rejected before any job was created."""
    layer: str = "ingestion"


class FileValidationError(IngestionError):
    layer = "file_validation"


class SecurityValidationError(IngestionError):
    layer = "security_validation"


class DocumentValidationError(IngestionError):
    layer = "document_validation"


# ── Pipeline ──────────────────────────────────────────────────────────────────

class PipelineError(ZeroxError):
    """Failure after job creation — job is marked FAILED."""


class RasterizationError(PipelineError):
    pass


class ExtractionError(PipelineError):
    pass


class ProviderError(PipelineError):
    """Vision / OCR provider returned an error or unparseable response."""


# ── Export ────────────────────────────────────────────────────────────────────

class ExportError(ZeroxError):
    pass