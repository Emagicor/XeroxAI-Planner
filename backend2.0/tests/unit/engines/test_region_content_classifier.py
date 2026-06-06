"""Unit tests for region content classification."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image

from domain.entities.detection import BoundingBox
from engines.detection.region_content_classifier import (
    REGION_KIND_DIMENSION_TABLE,
    REGION_KIND_FLOOR_PLAN,
    classify_region_content,
    is_table_like_bbox,
)


def _jpeg_from_array(arr: np.ndarray) -> bytes:
    img = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_is_table_like_bbox_wide_strip():
    bbox = BoundingBox(20, 200, 780, 320)
    assert is_table_like_bbox(bbox, 800, 600) is True


def test_is_table_like_bbox_tall_plan():
    bbox = BoundingBox(100, 40, 420, 560)
    assert is_table_like_bbox(bbox, 800, 600) is False


def test_classify_dimension_table_rows():
    """Many horizontal text bands → dimension table."""
    h, w = 120, 480
    arr = np.full((h, w, 3), 255, dtype=np.uint8)
    for row in range(0, h, 14):
        arr[row : row + 6, 20:460] = 30
    kind = classify_region_content(_jpeg_from_array(arr))
    assert kind == REGION_KIND_DIMENSION_TABLE


def test_classify_floor_plan_block():
    """Chunky vertical drawing block → floor plan."""
    h, w = 400, 280
    arr = np.full((h, w, 3), 255, dtype=np.uint8)
    arr[40:360, 60:220] = 40
    arr[80:120, 100:180] = 255
    kind = classify_region_content(_jpeg_from_array(arr))
    assert kind == REGION_KIND_FLOOR_PLAN
