"""Floor-plan region entities used during page expansion."""
from __future__ import annotations

from dataclasses import dataclass
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
    detection_method: str = "full_page_fallback"

    @staticmethod
    def new_id() -> str:
        return str(uuid4())
