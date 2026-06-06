"""HTTP schemas for floor-plan detection."""
from __future__ import annotations

from pydantic import BaseModel


class RegionBBoxSchema(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class DetectedRegionSchema(BaseModel):
    region_id: str
    region_index: int
    label: str
    confidence: float
    bbox: RegionBBoxSchema
    preview_image: str  # base64 JPEG
    detection_method: str
    region_kind: str = "unknown"  # floor_plan | dimension_table | unknown
    suggested_exclude: bool = False


class SourcePageSchema(BaseModel):
    page_number: int
    page_width: int
    page_height: int
    regions: list[DetectedRegionSchema]
    skipped: bool = False
    skip_reason: str | None = None


class DetectResponseSchema(BaseModel):
    detection_id: str
    filename: str
    content_sha256: str
    document_type: str
    source_page_count: int
    total_regions: int
    pages: list[SourcePageSchema]
    detection_method: str
    model_available: bool
    model_error: str | None = None
    scenario: str  # human-readable case label
