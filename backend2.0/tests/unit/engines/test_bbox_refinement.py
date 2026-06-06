"""Tests for floor-plan bbox post-processing."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageDraw

from domain.entities.detection import BoundingBox
from engines.detection.bbox_refinement import (
    _collapse_dominant_single_plan,
    _merge_fragment_boxes,
    refine_floor_plan_boxes,
)


def _jpeg_with_rect(x1, y1, x2, y2, size=(800, 600)) -> bytes:
    img = Image.new("RGB", size, color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([x1, y1, x2, y2], outline=(0, 0, 0), width=3)
  # fill interior lines so ink bbox covers region
    for x in range(x1 + 20, x2 - 20, 40):
        draw.line([(x, y1 + 30), (x, y2 - 30)], fill=(0, 0, 0), width=1)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _jpeg_with_rects(rects, size=(900, 700)) -> bytes:
    img = Image.new("RGB", size, color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    for x1, y1, x2, y2 in rects:
        draw.rectangle([x1, y1, x2, y2], outline=(0, 0, 0), width=4)
        draw.line([(x1 + 20, y1 + 40), (x2 - 20, y1 + 40)], fill=(0, 0, 0), width=2)
        draw.line([(x1 + 20, y1 + 90), (x2 - 20, y1 + 90)], fill=(0, 0, 0), width=2)
        draw.line([(x1 + 70, y1 + 20), (x1 + 70, y2 - 20)], fill=(0, 0, 0), width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_merge_side_by_side_fragments():
    w, h = 800, 600
    a = BoundingBox(50, 80, 380, 520)
    b = BoundingBox(400, 85, 750, 515)
    merged = _merge_fragment_boxes(
        [(a, 0.9, "floor plan"), (b, 0.85, "floor plan")],
        w,
        h,
    )
    assert len(merged) == 1
    assert merged[0][0].width > 600


def test_collapse_dominant_plus_fragment():
    w, h = 1000, 800
    page_area = w * h
    large = BoundingBox(40, 40, 960, 760)
    tiny = BoundingBox(900, 700, 980, 780)
    out = _collapse_dominant_single_plan(
        [(large, 0.92, "floor plan"), (tiny, 0.4, "floor plan")],
        page_area,
    )
    assert len(out) == 1
    assert out[0][0].area == large.area


def test_keep_multiple_small_plans_on_contact_sheet():
    """Four ~10% plans must not collapse to one (min_plan_area filter bug)."""
    w, h = 1024, 520
    page_area = w * h
    boxes = [
        (BoundingBox(28, 132, 225, 411), 0.9, "floor plan"),
        (BoundingBox(288, 129, 488, 413), 0.88, "floor plan"),
        (BoundingBox(536, 135, 734, 409), 0.87, "floor plan"),
        (BoundingBox(768, 132, 968, 412), 0.86, "floor plan"),
    ]
    from engines.detection.bbox_refinement import _filter_distinct_plans

    kept = _filter_distinct_plans(boxes, page_area)
    assert len(kept) == 4


def test_single_plan_expands_with_ink_bounds():
    jpeg = _jpeg_with_rect(120, 90, 680, 510)
    tight = BoundingBox(200, 150, 600, 450)
    refined = refine_floor_plan_boxes(jpeg, [(tight, 0.9, "floor plan")])
    assert len(refined) == 1
    box = refined[0][0]
    assert box.x1 <= 120
    assert box.y1 <= 90
    assert box.x2 >= 680
    assert box.y2 >= 510


def test_layout_component_fallback_finds_multiple_plans_on_normal_page():
    jpeg = _jpeg_with_rects(
        [
            (70, 80, 380, 300),
            (520, 80, 830, 300),
            (70, 390, 380, 630),
            (520, 390, 830, 630),
        ],
        size=(900, 700),
    )

    refined = refine_floor_plan_boxes(jpeg, [])

    assert len(refined) == 4
    assert refined[0][0].x1 < refined[1][0].x1
    assert refined[0][0].y1 < refined[2][0].y1
