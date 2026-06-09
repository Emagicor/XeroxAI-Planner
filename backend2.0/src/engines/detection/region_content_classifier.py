"""
Classify clipped regions as floor plans vs dimension/schedule tables.

Grounding DINO often picks up room-dimension tables on the same sheet as the
actual floor plan. These heuristics flag wide, row-structured crops.
"""
from __future__ import annotations

import io

import numpy as np
import structlog
from PIL import Image

from domain.entities.detection import BoundingBox

log = structlog.get_logger(__name__)

REGION_KIND_FLOOR_PLAN = "floor_plan"
REGION_KIND_DIMENSION_TABLE = "dimension_table"
REGION_KIND_UNKNOWN = "unknown"


def is_table_like_bbox(bbox: BoundingBox, page_w: int, page_h: int) -> bool:
    """Wide shallow box on a sheet — typical dimension schedule strip."""
    if page_w <= 0 or page_h <= 0:
        return False

    aspect = bbox.width / max(bbox.height, 1)
    height_ratio = bbox.height / page_h
    width_ratio = bbox.width / page_w

    if aspect >= 2.0 and height_ratio <= 0.48 and width_ratio >= 0.30:
        return True
    if aspect >= 3.0 and height_ratio <= 0.58:
        return True
    return False


def _row_band_score(ink: np.ndarray) -> tuple[int, float]:
    """Count horizontal text bands and how regular they are."""
    row_ink = ink.sum(axis=1).astype(np.float32)
    if row_ink.max() <= 0:
        return 0, 0.0

    threshold = row_ink.max() * 0.12
    active = row_ink > threshold
    if not active.any():
        return 0, 0.0

    bands = 0
    in_band = False
    for val in active:
        if val and not in_band:
            bands += 1
            in_band = True
        elif not val:
            in_band = False

    # Tables: many thin horizontal bands; floor plans: fewer, chunkier regions
    return bands, float(row_ink.std() / max(row_ink.mean(), 1.0))


def classify_region_content(jpeg_bytes: bytes) -> str:
    """
    Classify a clipped region image.

    Returns floor_plan | dimension_table | unknown.
    """
    from infrastructure.imaging.color_fidelity import content_mask_from_rgb, load_rgb

    img = load_rgb(jpeg_bytes)
    w, h = img.size
    if w < 8 or h < 8:
        return REGION_KIND_UNKNOWN

    aspect = w / max(h, 1)
    arr = np.asarray(img)
    ink = content_mask_from_rgb(arr)
    ink_ratio = float(ink.mean())

    bands, row_var = _row_band_score(ink)

    # Wide strip with many horizontal text rows → dimension table
    if aspect >= 1.8 and bands >= 5 and h <= w * 0.65:
        log.debug(
            "region_classifier.dimension_table",
            aspect=round(aspect, 2),
            bands=bands,
            ink_ratio=round(ink_ratio, 3),
        )
        return REGION_KIND_DIMENSION_TABLE

    if aspect >= 2.4 and bands >= 4:
        return REGION_KIND_DIMENSION_TABLE

    # Dense row structure with low vertical spread
    if aspect >= 1.6 and bands >= 7 and row_var < 1.4:
        return REGION_KIND_DIMENSION_TABLE

    # Tall or near-square drawings with moderate aspect → floor plan
    if 0.35 <= aspect <= 2.2 and bands <= 6:
        return REGION_KIND_FLOOR_PLAN

    if aspect < 1.5 and ink_ratio >= 0.02:
        return REGION_KIND_FLOOR_PLAN

    return REGION_KIND_UNKNOWN
