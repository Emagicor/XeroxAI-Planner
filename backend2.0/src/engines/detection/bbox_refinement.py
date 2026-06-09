"""
Post-process Grounding DINO boxes to reduce false splits and over-tight crops.

Common failure modes addressed:
  - One floor plan detected as two adjacent boxes → merge clusters
  - Dominant box + small fragment → keep / merge to single plan
  - Tight box cutting title blocks / margins → pad + ink-bounds expansion
  - Near full-page detection → snap to full page (no crop loss)
"""
from __future__ import annotations

import io

import numpy as np
import structlog
from PIL import Image

from config.settings import get_settings
from domain.entities.detection import BoundingBox
from engines.detection.region_content_classifier import is_table_like_bbox
from infrastructure.imaging.color_fidelity import content_mask_from_rgb, load_rgb

log = structlog.get_logger(__name__)


def _iou(a: BoundingBox, b: BoundingBox) -> float:
    ix1 = max(a.x1, b.x1)
    iy1 = max(a.y1, b.y1)
    ix2 = min(a.x2, b.x2)
    iy2 = min(a.y2, b.y2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    union = a.area + b.area - inter
    return inter / union if union > 0 else 0.0


def _min_gap(a: BoundingBox, b: BoundingBox) -> float:
    """Minimum edge-to-edge gap between two boxes (0 if overlapping)."""
    dx = max(0, max(a.x1, b.x1) - min(a.x2, b.x2))
    dy = max(0, max(a.y1, b.y1) - min(a.y2, b.y2))
    return float((dx * dx + dy * dy) ** 0.5)


def _vertical_overlap_ratio(a: BoundingBox, b: BoundingBox) -> float:
    overlap = min(a.y2, b.y2) - max(a.y1, b.y1)
    if overlap <= 0:
        return 0.0
    return overlap / max(1, min(a.height, b.height))


def _union_bbox(boxes: list[BoundingBox]) -> BoundingBox:
    return BoundingBox(
        x1=min(b.x1 for b in boxes),
        y1=min(b.y1 for b in boxes),
        x2=max(b.x2 for b in boxes),
        y2=max(b.y2 for b in boxes),
    )


def _clip_to_page(bbox: BoundingBox, w: int, h: int) -> BoundingBox:
    return BoundingBox(
        x1=max(0, min(bbox.x1, w)),
        y1=max(0, min(bbox.y1, h)),
        x2=max(0, min(bbox.x2, w)),
        y2=max(0, min(bbox.y2, h)),
    )


def _pad_bbox(
    bbox: BoundingBox,
    w: int,
    h: int,
    *,
    ratio: float,
    px: int,
) -> BoundingBox:
    pad_x = max(int(bbox.width * ratio), px)
    pad_y = max(int(bbox.height * ratio), px)
    return _clip_to_page(
        BoundingBox(
            x1=bbox.x1 - pad_x,
            y1=bbox.y1 - pad_y,
            x2=bbox.x2 + pad_x,
            y2=bbox.y2 + pad_y,
        ),
        w,
        h,
    )


def _ink_bounding_box(jpeg_bytes: bytes, threshold: int = 245) -> BoundingBox | None:
    """Axis-aligned bounds of non-white pixels (drawing ink)."""
    img = load_rgb(jpeg_bytes)
    arr = np.asarray(img)
    mask = content_mask_from_rgb(arr, threshold=threshold)
    if not mask.any():
        return None
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if rows.size == 0 or cols.size == 0:
        return None
    return BoundingBox(
        x1=int(cols[0]),
        y1=int(rows[0]),
        x2=int(cols[-1] + 1),
        y2=int(rows[-1] + 1),
    )


def _ink_inside_bbox(jpeg_bytes: bytes, bbox: BoundingBox, threshold: int = 245) -> BoundingBox | None:
    """Ink bounds restricted to a region (for multi-plan pages)."""
    img = load_rgb(jpeg_bytes)
    arr = np.asarray(img)
    x1, y1, x2, y2 = bbox.x1, bbox.y1, bbox.x2, bbox.y2
    crop = arr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    mask = content_mask_from_rgb(crop, threshold=threshold)
    if not mask.any():
        return None
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    return BoundingBox(
        x1=x1 + int(cols[0]),
        y1=y1 + int(rows[0]),
        x2=x1 + int(cols[-1] + 1),
        y2=y1 + int(rows[-1] + 1),
    )


def _horizontal_overlap_ratio(a: BoundingBox, b: BoundingBox) -> float:
    overlap = min(a.x2, b.x2) - max(a.x1, b.x1)
    if overlap <= 0:
        return 0.0
    return overlap / max(1, min(a.width, b.width))


def _should_merge_pair(
    a: BoundingBox,
    b: BoundingBox,
    w: int,
    h: int,
    *,
    merge_iou: float,
    max_gap_ratio: float,
) -> bool:
    if _iou(a, b) >= merge_iou:
        return True

    page_min = min(w, h)
    gap = _min_gap(a, b)
    max_gap = max_gap_ratio * page_min
    if gap > max_gap * 1.5:
        return False

    # Distinct columns on a contact sheet: aligned vertically, separated horizontally.
    if (
        _vertical_overlap_ratio(a, b) >= 0.45
        and _horizontal_overlap_ratio(a, b) < 0.12
        and gap > max_gap
    ):
        return False

    # Adjacent fragments of one plan (tight gap or significant horizontal overlap)
    if _vertical_overlap_ratio(a, b) >= 0.45 and gap <= max_gap:
        return True

    overlap_x = min(a.x2, b.x2) - max(a.x1, b.x1)
    if overlap_x > 0 and overlap_x >= 0.45 * min(a.width, b.width):
        return True

    areas = sorted([a.area, b.area], reverse=True)
    if areas[1] / max(areas[0], 1) >= 0.35 and gap <= max_gap * 1.5:
        return True

    return False


def _merge_fragment_boxes(
    boxes: list[tuple[BoundingBox, float, str]],
    w: int,
    h: int,
) -> list[tuple[BoundingBox, float, str]]:
    """Merge boxes that likely belong to one floor plan."""
    settings = get_settings()
    if len(boxes) <= 1:
        return boxes

    merged: list[tuple[BoundingBox, float, str]] = list(boxes)
    changed = True
    while changed:
        changed = False
        next_list: list[tuple[BoundingBox, float, str]] = []
        used: set[int] = set()

        for i, (a, score_a, label_a) in enumerate(merged):
            if i in used:
                continue
            cluster = [(a, score_a, label_a)]
            used.add(i)

            for j, (b, score_b, label_b) in enumerate(merged):
                if j in used:
                    continue
                if _should_merge_pair(
                    a,
                    b,
                    w,
                    h,
                    merge_iou=settings.detection_merge_iou,
                    max_gap_ratio=settings.detection_merge_gap_ratio,
                ):
                    cluster.append((b, score_b, label_b))
                    used.add(j)
                    changed = True

            if len(cluster) == 1:
                next_list.append(cluster[0])
            else:
                union = _union_bbox([c[0] for c in cluster])
                best_score = max(c[1] for c in cluster)
                next_list.append((union, best_score, cluster[0][2]))

        merged = next_list

    return merged


def _collapse_dominant_single_plan(
    boxes: list[tuple[BoundingBox, float, str]],
    page_area: int,
) -> list[tuple[BoundingBox, float, str]]:
    """One large detection + small fragments → single plan."""
    settings = get_settings()
    if len(boxes) <= 1:
        return boxes

    ranked = sorted(boxes, key=lambda x: x[0].area, reverse=True)
    largest, lscore, llabel = ranked[0]
    largest_ratio = largest.area / page_area

    if largest_ratio < settings.detection_dominant_plan_ratio:
        return boxes

    fragments = [
        b for b in ranked[1:]
        if b[0].area / page_area < settings.detection_fragment_max_ratio
    ]
    if len(fragments) != len(ranked) - 1:
        return boxes

    log.info(
        "bbox_refinement.collapse_dominant",
        largest_ratio=round(largest_ratio, 3),
        fragments=len(fragments),
    )
    return [(largest, lscore, llabel)]


def _filter_table_boxes(
    boxes: list[tuple[BoundingBox, float, str]],
    w: int,
    h: int,
) -> list[tuple[BoundingBox, float, str]]:
    """Drop wide dimension-table strips when at least one floor-plan box remains."""
    if len(boxes) <= 1:
        return boxes

    table_like = [b for b in boxes if is_table_like_bbox(b[0], w, h)]
    if not table_like or len(table_like) >= len(boxes):
        return boxes

    kept = [b for b in boxes if not is_table_like_bbox(b[0], w, h)]
    if kept:
        log.info(
            "bbox_refinement.filter_tables",
            removed=len(boxes) - len(kept),
            kept=len(kept),
        )
        return kept
    return boxes


def _filter_distinct_plans(
    boxes: list[tuple[BoundingBox, float, str]],
    page_area: int,
) -> list[tuple[BoundingBox, float, str]]:
    """Drop tiny detections; merge highly overlapping siblings."""
    settings = get_settings()
    min_area = page_area * settings.detection_min_plan_area_ratio

    kept = [b for b in boxes if b[0].area >= min_area]
    if not kept and len(boxes) >= 2:
        # Multi-plan contact sheets: each plan is often 8–20% of page area.
        softer = page_area * settings.detection_min_area_ratio
        kept = [b for b in boxes if b[0].area >= softer]
    if not kept:
        return sorted(boxes, key=lambda x: x[1], reverse=True)[:1] if boxes else []

    result: list[tuple[BoundingBox, float, str]] = []
    for box in sorted(kept, key=lambda x: x[1], reverse=True):
        if any(_iou(box[0], r[0]) >= settings.detection_duplicate_iou for r in result):
            continue
        result.append(box)
    return result


def _expand_box_conservatively(
    bbox: BoundingBox,
    jpeg_bytes: bytes,
    w: int,
    h: int,
    *,
    single_plan: bool,
) -> BoundingBox:
    settings = get_settings()
    page_area = w * h
    ratio = bbox.area / page_area

    if ratio >= settings.detection_full_page_snap_ratio:
        log.debug("bbox_refinement.snap_full_page", area_ratio=round(ratio, 3))
        return BoundingBox(0, 0, w, h)

    padded = _pad_bbox(
        bbox,
        w,
        h,
        ratio=settings.detection_bbox_padding,
        px=settings.detection_bbox_padding_px,
    )

    if single_plan:
        ink = _ink_bounding_box(jpeg_bytes)
        if ink:
            padded = _union_bbox([padded, ink])

    else:
        # Search a wider column so title blocks / legends above the drawing are included.
        search = _pad_bbox(
            bbox,
            w,
            h,
            ratio=settings.detection_bbox_padding * 2.2,
            px=settings.detection_bbox_padding_px * 2,
        )
        ink = _ink_inside_bbox(jpeg_bytes, search)
        if ink:
            padded = _union_bbox([padded, ink])

    padded = _pad_bbox(
        padded,
        w,
        h,
        ratio=settings.detection_bbox_padding * 0.5,
        px=settings.detection_bbox_padding_px // 2,
    )

    if padded.area / page_area >= settings.detection_full_page_snap_ratio:
        return BoundingBox(0, 0, w, h)

    return _clip_to_page(padded, w, h)


def _split_wide_sheet_columns(
    jpeg_bytes: bytes,
    w: int,
    h: int,
) -> list[tuple[BoundingBox, float, str]]:
    """
    Fallback for wide sheets: split by vertical ink gutters between plan columns.
    """
    settings = get_settings()
    if w / max(h, 1) < settings.detection_wide_aspect_ratio:
        return []

    img = load_rgb(jpeg_bytes)
    arr = np.asarray(img)
    mask = content_mask_from_rgb(arr)
    if not mask.any():
        return []

    col_ink = mask.sum(axis=0).astype(np.float32)
    kernel = max(3, w // 80)
    kernel = kernel + 1 if kernel % 2 == 0 else kernel
    smoothed = np.convolve(col_ink, np.ones(kernel) / kernel, mode="same")

    row_ink = mask.sum(axis=1)
    y_rows = np.where(row_ink > row_ink.max() * 0.08)[0]
    if y_rows.size == 0:
        return []
    y1, y2 = int(y_rows[0]), int(y_rows[-1] + 1)

    gutter = smoothed.max() * 0.06
    segments: list[tuple[int, int]] = []
    in_seg = False
    start = 0
    for x in range(w):
        if smoothed[x] > gutter:
            if not in_seg:
                start = x
                in_seg = True
        elif in_seg:
            if x - start >= w * 0.08:
                segments.append((start, x))
            in_seg = False
    if in_seg and w - start >= w * 0.08:
        segments.append((start, w))

    if len(segments) < 2:
        return []

    page_area = w * h
    pad_x = max(int(w * 0.01), 8)
    pad_y = max(int(h * 0.02), 8)
    boxes: list[tuple[BoundingBox, float, str]] = []
    for x1, x2 in segments:
        bbox = _clip_to_page(
            BoundingBox(x1 - pad_x, y1 - pad_y, x2 + pad_x, y2 + pad_y),
            w,
            h,
        )
        if bbox.area >= page_area * settings.detection_min_area_ratio * 0.5:
            boxes.append((bbox, 0.75, "floor plan column"))
    return boxes


def _sort_reading_order(
    boxes: list[tuple[BoundingBox, float, str]],
) -> list[tuple[BoundingBox, float, str]]:
    if len(boxes) <= 1:
        return boxes

    median_h = float(np.median([b[0].height for b in boxes]))
    row_band = max(1.0, median_h * 0.6)
    return sorted(boxes, key=lambda b: (round(b[0].y1 / row_band), b[0].x1))


def _split_layout_components(
    jpeg_bytes: bytes,
    w: int,
    h: int,
) -> list[tuple[BoundingBox, float, str]]:
    """
    Fallback for pages/images containing multiple separate plan drawings.

    Grounding DINO can miss contact sheets or return one weak full-page region.
    This uses ink connectivity after morphology to find distinct drawing blocks
    in rows, columns, or grids without assuming a wide page aspect ratio.
    """
    try:
        import cv2
    except Exception:
        return []

    settings = get_settings()
    img = load_rgb(jpeg_bytes)
    arr = np.asarray(img)
    mask = content_mask_from_rgb(arr).astype(np.uint8) * 255
    if not mask.any():
        return []

    kernel_w = max(9, w // 70)
    kernel_h = max(9, h // 70)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_w, kernel_h))
    connected = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    connected = cv2.dilate(connected, kernel, iterations=1)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(connected, 8)
    page_area = w * h
    min_area = page_area * max(0.018, settings.detection_min_area_ratio * 0.45)
    max_area = page_area * 0.86
    candidates: list[tuple[BoundingBox, float, str]] = []

    for label_idx in range(1, count):
        x, y, bw, bh, area = stats[label_idx]
        if area < min_area or area > max_area:
            continue
        bbox = _clip_to_page(
            BoundingBox(int(x), int(y), int(x + bw), int(y + bh)),
            w,
            h,
        )
        if bbox.width < w * 0.12 or bbox.height < h * 0.12:
            continue
        if is_table_like_bbox(bbox, w, h):
            continue
        candidates.append((bbox, 0.72, "floor plan layout region"))

    if len(candidates) < 2:
        return []

    candidates = _filter_distinct_plans(candidates, page_area)
    if len(candidates) < 2:
        return []

    log.info("bbox_refinement.layout_components", count=len(candidates))
    return _sort_reading_order(candidates)


def refine_floor_plan_boxes(
    jpeg_bytes: bytes,
    raw_boxes: list[tuple[BoundingBox, float, str]],
) -> list[tuple[BoundingBox, float, str]]:
    """
    Clean up raw DINO detections before clipping.

    Returns at least one box (full page) when refinement removes everything.
    """
    img = load_rgb(jpeg_bytes)
    w, h = img.size
    page_area = w * h

    if not raw_boxes:
        layout = _split_layout_components(jpeg_bytes, w, h)
        if not layout:
            layout = _split_wide_sheet_columns(jpeg_bytes, w, h)
        if layout:
            log.info("bbox_refinement.layout_fallback", count=len(layout))
            raw_boxes = layout
        else:
            return [(BoundingBox(0, 0, w, h), 1.0, "full page")]

    boxes = sorted(raw_boxes, key=lambda x: x[1], reverse=True)
    boxes = _merge_fragment_boxes(boxes, w, h)
    boxes = _collapse_dominant_single_plan(boxes, page_area)
    boxes = _filter_table_boxes(boxes, w, h)
    boxes = _filter_distinct_plans(boxes, page_area)

    if not boxes:
        log.info("bbox_refinement.fallback_full_page", reason="all_filtered")
        return [(BoundingBox(0, 0, w, h), 1.0, "full page")]

    single_plan = len(boxes) == 1
    refined: list[tuple[BoundingBox, float, str]] = []
    for bbox, score, label in boxes:
        expanded = _expand_box_conservatively(
            bbox,
            jpeg_bytes,
            w,
            h,
            single_plan=single_plan,
        )
        refined.append((expanded, score, label))

    log.info(
        "bbox_refinement.done",
        raw=len(raw_boxes),
        final=len(refined),
        single_plan=single_plan,
    )
    return _sort_reading_order(refined)
