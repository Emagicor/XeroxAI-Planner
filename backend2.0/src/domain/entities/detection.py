"""Floor-plan region detection entities."""
from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4


@dataclass(frozen=True)
class BoundingBox:
    """Pixel-space axis-aligned box [x1, y1, x2, y2]."""

    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def width(self) -> int:
        return max(0, self.x2 - self.x1)

    @property
    def height(self) -> int:
        return max(0, self.y2 - self.y1)

    @property
    def area(self) -> int:
        return self.width * self.height

    def as_list(self) -> list[int]:
        return [self.x1, self.y1, self.x2, self.y2]


@dataclass
class DetectedRegion:
    region_id: str
    source_page: int
    region_index: int
    label: str
    confidence: float
    bbox: BoundingBox
    jpeg_bytes: bytes
    detection_method: str = "grounding_dino"  # grounding_dino | full_page_fallback
    region_kind: str = "unknown"  # floor_plan | dimension_table | unknown
    suggested_exclude: bool = False

    @staticmethod
    def new_id() -> str:
        return str(uuid4())


@dataclass
class SourcePageDetection:
    page_number: int
    page_width: int
    page_height: int
    regions: list[DetectedRegion] = field(default_factory=list)
    skipped: bool = False
    skip_reason: str | None = None
    page_preview_bytes: bytes | None = None


@dataclass
class DocumentDetection:
    detection_id: str
    filename: str
    content_sha256: str
    document_type: str  # image | pdf
    source_page_count: int
    total_regions: int
    pages: list[SourcePageDetection]
    detection_method: str = "grounding_dino"
