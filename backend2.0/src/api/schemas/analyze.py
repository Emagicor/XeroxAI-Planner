"""
api/schemas/analyze.py

Pydantic models that live only at the HTTP boundary.
They serialize domain entities → JSON and validate incoming requests.
They do NOT duplicate domain logic.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RoomSchema(BaseModel):
    room_id:          str
    name:             str
    bbox:             list[int]
    polygon:          list[list[int]]
    length_ft:        float | None
    width_ft:         float | None
    area_sqft:        float | None       # null for assumed rooms
    confidence_pct:   int
    dimension_source: str                # "measured" | "derived" | "assumed"
    assumptions:      list[str]
    is_assumed:       bool


class PageSchema(BaseModel):
    page_number:            int
    plan_number:            int | None = None
    page_type:              str
    eligible:               bool
    floor_label:            str | None = None
    floor_label_confidence: int | None = None
    ineligible_reason:      str | None = None
    rooms:                  list[RoomSchema] = []
    total_area_sqft:        float
    total_area_source:      str
    layout_dimensions_used: dict | None = None
    overall_confidence:     int
    units_detected:         str
    has_annotated_image:    bool = False
    annotated_image:        str | None = None  # base64 JPEG; set for single-page responses
    source_page:            int | None = None
    region_index:           int | None = None
    region_id:              str | None = None
    region_label:           str | None = None
    detection_confidence:   float | None = None
    detection_method:       str | None = None
    clip_preview:           str | None = None


class AnalyzeResponseSchema(BaseModel):
    job_id:             str
    filename:           str
    content_sha256:     str = ""
    status:             str
    total_pages:        int | None
    source_page_count:  int | None = None
    total_regions:      int | None = None
    scenario:           str | None = None
    pages:              list[PageSchema]
    grand_total_sqft:   float
    eligible_pages:     int
    ineligible_pages:   int
    has_assumed:        bool
    has_low_confidence: bool
    created_at:         datetime


class ExportRequestSchema(BaseModel):
    job_id: str
    unit: str = Field(default="sqft", pattern="^(sqft|sqm|sq-in|sq-cm)$")


class StreamEventSchema(BaseModel):
    """Shape of each SSE event."""
    type:        str           # "progress" | "done" | "error"
    page:        int | None = None
    total_pages: int | None = None
    data:        dict | None = None
    # done fields
    grand_total_sqft:  float | None = None
    eligible_pages:    int | None = None
    ineligible_pages:  int | None = None
    page_count:        int | None = None
    # error fields
    message:     str | None = None
