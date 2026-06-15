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
    source_page:            int | None = None
    region_index:           int | None = None
    region_id:              str | None = None
    region_label:           str | None = None
    detection_confidence:   float | None = None
    detection_method:       str | None = None
    clip_preview:           str | None = None


class TokenUsageSchema(BaseModel):
    prompt_token_count: int | None = None
    candidates_token_count: int | None = None
    thoughts_token_count: int | None = None
    total_token_count: int | None = None


class VisionPassSchema(BaseModel):
    pass_number: int = Field(alias="pass")
    pass_kind: str
    provider: str
    model: str | None = None
    page_number: int | None = None
    prompt_token_count: int | None = None
    candidates_token_count: int | None = None
    thoughts_token_count: int | None = None
    total_token_count: int | None = None
    correction_mode: str | None = None
    correction_fields: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class VisionModelRefSchema(BaseModel):
    provider: str | None = None
    model: str | None = None


class VisionUsageSchema(BaseModel):
    api_calls: int = 0
    passes: list[VisionPassSchema] = []
    pages: list[dict[str, Any]] = []
    totals: TokenUsageSchema = Field(default_factory=TokenUsageSchema)
    models: dict[str, VisionModelRefSchema] = Field(default_factory=dict)


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
    vision_usage:       VisionUsageSchema | None = None


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
