"""
Domain Entities — pure dataclasses, zero framework/DB imports.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from domain.entities.vision_usage import JobVisionUsage, VisionUsageSnapshot


# ── Enums (value objects) ─────────────────────────────────────────────────────

class JobStatus(str, Enum):
    PENDING    = "pending"
    INGESTING  = "ingesting"
    PROCESSING = "processing"
    EXTRACTING = "extracting"
    COMPUTING  = "computing"
    COMPLETE   = "complete"
    FAILED     = "failed"


class DimensionSource(str, Enum):
    MEASURED = "measured"    # printed label on plan — highest priority
    DERIVED  = "derived"     # geometric / scale inference
    ASSUMED  = "assumed"     # could not be determined — null dims, flagged


class PageType(str, Enum):
    FLOORPLAN = "floorplan"
    ELEVATION = "elevation"
    SECTION   = "section"
    NOTES     = "notes"
    SCHEDULE  = "schedule"
    COVER     = "cover"
    UNKNOWN   = "unknown"


class ConfidenceLevel(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


# ── Room ─────────────────────────────────────────────────────────────────────

@dataclass
class RoomResult:
    name: str
    bbox: list[int]                    # [x_min, y_min, x_max, y_max] 0–1000
    polygon: list[list[int]]           # [[x,y], ...] clockwise
    length_ft: float | None
    width_ft: float | None
    area_sqft: float | None            # None = assumed/ineligible
    confidence_pct: int                # 0–100
    dimension_source: DimensionSource
    assumptions: list[str]
    room_id: str = field(default_factory=lambda: str(uuid4()))

    @property
    def is_assumed(self) -> bool:
        return self.dimension_source == DimensionSource.ASSUMED

    @property
    def confidence_level(self) -> ConfidenceLevel:
        from config.constants import HIGH_CONFIDENCE_MIN, MEDIUM_CONFIDENCE_MIN
        if self.confidence_pct >= HIGH_CONFIDENCE_MIN:
            return ConfidenceLevel.HIGH
        if self.confidence_pct >= MEDIUM_CONFIDENCE_MIN:
            return ConfidenceLevel.MEDIUM
        return ConfidenceLevel.LOW


# ── Page ─────────────────────────────────────────────────────────────────────

@dataclass
class PageResult:
    page_number: int
    page_type: PageType
    eligible: bool
    plan_number: int | None = None
    floor_label: str | None = None
    floor_label_confidence: int | None = None
    rooms: list[RoomResult] = field(default_factory=list)
    ineligible_reason: str | None = None
    total_area_sqft: float = 0.0
    total_area_source: str = "room_sum"   # "room_sum" | "layout_dimensions"
    layout_dimensions_used: dict | None = None
    overall_confidence: int = 0
    units_detected: str = "feet"
    annotated_image: str | None = None  # base64 JPEG
    # Region metadata (when a document page yields multiple plans)
    source_page: int | None = None
    region_index: int | None = None
    region_id: str | None = None
    region_label: str | None = None
    detection_confidence: float | None = None
    detection_method: str | None = None
    clip_preview: str | None = None  # base64 JPEG of clipped region sent to vision
    vision_usage: VisionUsageSnapshot | None = None

    def compute_totals(self) -> None:
        """Recompute total_area_sqft from rooms. Called after all rooms are set."""
        eligible_areas = [
            r.area_sqft for r in self.rooms if r.area_sqft is not None
        ]
        self.total_area_sqft = round(sum(eligible_areas), 2)
        if self.rooms:
            self.overall_confidence = round(
                sum(r.confidence_pct for r in self.rooms) / len(self.rooms)
            )


# ── Job ───────────────────────────────────────────────────────────────────────

@dataclass
class AnalyzeJob:
    filename: str
    file_size_bytes: int
    content_sha256: str = ""
    job_id: str = field(default_factory=lambda: str(uuid4()))
    status: JobStatus = JobStatus.PENDING
    total_pages: int | None = None
    current_page: int | None = None
    pages: list[PageResult] = field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    vision_usage: JobVisionUsage | None = None

    # ── state transitions ─────────────────────────────────────────────────

    def mark_ingesting(self) -> None:      self._transition(JobStatus.INGESTING)
    def mark_processing(self, n: int) -> None:
        self.total_pages = n
        self._transition(JobStatus.PROCESSING)
    def mark_extracting(self) -> None:     self._transition(JobStatus.EXTRACTING)
    def mark_computing(self) -> None:      self._transition(JobStatus.COMPUTING)
    def mark_complete(self) -> None:       self._transition(JobStatus.COMPLETE)
    def mark_failed(self, code: str, msg: str) -> None:
        self.error_code = code
        self.error_message = msg
        self._transition(JobStatus.FAILED)

    def advance_page(self, n: int) -> None:
        self.current_page = n
        self._touch()

    def _transition(self, s: JobStatus) -> None:
        self.status = s
        self._touch()

    def _touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc)

    # ── computed properties ───────────────────────────────────────────────

    @property
    def eligible_pages(self) -> list[PageResult]:
        return [p for p in self.pages if p.eligible]

    @property
    def ineligible_pages(self) -> list[PageResult]:
        return [p for p in self.pages if not p.eligible]

    @property
    def grand_total_sqft(self) -> float:
        return round(sum(p.total_area_sqft for p in self.eligible_pages), 2)

    @property
    def has_assumed(self) -> bool:
        return any(r.is_assumed for p in self.pages for r in p.rooms)

    @property
    def has_low_confidence(self) -> bool:
        return any(
            r.confidence_level == ConfidenceLevel.LOW
            for p in self.pages for r in p.rooms
        )
