"""Prepare full-page floor-plan regions from rasterized page images."""
from __future__ import annotations

from config.settings import get_settings
from domain.entities.detection import BoundingBox, DetectedRegion
from infrastructure.imaging.color_fidelity import load_rgb, save_image


def _pad_bbox(
    bbox: BoundingBox,
    width: int,
    height: int,
    padding_ratio: float,
    padding_px: int = 0,
) -> BoundingBox:
    pad_x = max(int(bbox.width * padding_ratio), padding_px)
    pad_y = max(int(bbox.height * padding_ratio), padding_px)
    return BoundingBox(
        x1=max(0, bbox.x1 - pad_x),
        y1=max(0, bbox.y1 - pad_y),
        x2=min(width, bbox.x2 + pad_x),
        y2=min(height, bbox.y2 + pad_y),
    )


def clip_region(
    jpeg_bytes: bytes,
    bbox: BoundingBox,
    *,
    source_page: int,
    region_index: int,
    label: str,
    confidence: float,
    detection_method: str = "full_page_fallback",
) -> DetectedRegion:
    settings = get_settings()
    img = load_rgb(jpeg_bytes)
    w, h = img.size
    # Add a small safety margin at clip time.
    padded = _pad_bbox(
        bbox,
        w,
        h,
        settings.detection_clip_padding_ratio,
        settings.detection_clip_padding_px,
    )

    crop = img.crop((padded.x1, padded.y1, padded.x2, padded.y2))
    clip_bytes, _clip_mime = save_image(
        crop,
        fmt=settings.vision_image_format,
        jpeg_quality=settings.jpeg_quality,
    )

    return DetectedRegion(
        region_id=DetectedRegion.new_id(),
        source_page=source_page,
        region_index=region_index,
        label=label,
        confidence=confidence,
        bbox=padded,
        jpeg_bytes=clip_bytes,
        detection_method=detection_method,
    )


def full_page_region(
    jpeg_bytes: bytes,
    *,
    source_page: int,
    label: str = "full page",
    confidence: float = 1.0,
    detection_method: str = "full_page_fallback",
) -> DetectedRegion:
    img = load_rgb(jpeg_bytes)
    w, h = img.size
    bbox = BoundingBox(0, 0, w, h)
    return clip_region(
        jpeg_bytes,
        bbox,
        source_page=source_page,
        region_index=1,
        label=label,
        confidence=confidence,
        detection_method=detection_method,
    )
