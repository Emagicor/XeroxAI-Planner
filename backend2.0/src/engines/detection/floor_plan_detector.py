"""
Grounding DINO zero-shot floor plan region detection.

Default backend loads the official GroundingDINO repo from disk (no API key).
Set GROUNDING_DINO_BACKEND=huggingface to use HuggingFace transformers instead.
Falls back to full-page clip when the model cannot load.
"""
from __future__ import annotations

import io
import threading
from typing import TYPE_CHECKING

import structlog
from PIL import Image

from config.settings import get_settings
from domain.entities.detection import BoundingBox
from engines.detection.bbox_refinement import refine_floor_plan_boxes

if TYPE_CHECKING:
    pass

log = structlog.get_logger(__name__)

_model_lock = threading.Lock()
_processor = None
_model = None
_load_error: str | None = None


def _backend() -> str:
    return get_settings().grounding_dino_backend.strip().lower()


def _ensure_hf_model():
    global _processor, _model, _load_error
    if _model is not None or _load_error is not None:
        return

    with _model_lock:
        if _model is not None or _load_error is not None:
            return
        settings = get_settings()
        if not settings.grounding_dino_enabled:
            _load_error = "Grounding DINO disabled in settings"
            return
        try:
            import torch
            from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

            model_id = settings.grounding_dino_model
            log.info("grounding_dino.hf.loading", model=model_id)
            _processor = AutoProcessor.from_pretrained(model_id)
            _model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id)
            _model.eval()
            if settings.grounding_dino_device == "cpu":
                _model.to("cpu")
            elif torch.cuda.is_available():
                _model.to("cuda")
            log.info("grounding_dino.hf.ready", model=model_id)
        except Exception as exc:
            _load_error = str(exc)
            log.warning("grounding_dino.hf.load_failed", error=_load_error)


def _ensure_model():
    if _backend() == "huggingface":
        _ensure_hf_model()
    else:
        from engines.detection import local_grounding_dino

        local_grounding_dino._load_local_model()


def model_available() -> bool:
    _ensure_model()
    if _backend() == "huggingface":
        return _model is not None
    from engines.detection import local_grounding_dino

    return local_grounding_dino.local_model_available()


def model_status() -> dict:
    _ensure_model()
    if _backend() == "huggingface":
        return {
            "available": _model is not None,
            "error": _load_error,
            "backend": "huggingface",
            "model": get_settings().grounding_dino_model,
        }
    from engines.detection import local_grounding_dino

    return local_grounding_dino.local_model_status()


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


def _nms(boxes: list[tuple[BoundingBox, float, str]], iou_threshold: float) -> list[tuple[BoundingBox, float, str]]:
    if len(boxes) <= 1:
        return boxes
    sorted_boxes = sorted(boxes, key=lambda x: x[1], reverse=True)
    kept: list[tuple[BoundingBox, float, str]] = []
    for candidate in sorted_boxes:
        if all(_iou(candidate[0], k[0]) < iou_threshold for k in kept):
            kept.append(candidate)
    return kept


def _raw_boxes_from_hf(img: Image.Image, w: int, h: int, min_area: int) -> list[tuple[BoundingBox, float, str]]:
    settings = get_settings()
    return _raw_boxes_from_hf_at_threshold(
        img, w, h, min_area, settings.grounding_dino_threshold
    )


def _raw_boxes_from_local_at_threshold(
    img: Image.Image,
    w: int,
    h: int,
    min_area: int,
    box_threshold: float,
) -> list[tuple[BoundingBox, float, str]]:
    from engines.detection import local_grounding_dino

    settings = get_settings()
    detections = local_grounding_dino.predict_local_boxes(
        img,
        caption=settings.grounding_dino_prompt,
        box_threshold=box_threshold,
        text_threshold=settings.grounding_dino_text_threshold,
        device=settings.grounding_dino_device,
    )
    raw_boxes: list[tuple[BoundingBox, float, str]] = []
    for (x1, y1, x2, y2), score, label in detections:
        bbox = BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)
        if bbox.area < min_area:
            continue
        raw_boxes.append((bbox, score, label))
    return raw_boxes


def _raw_boxes_from_hf_at_threshold(
    img: Image.Image,
    w: int,
    h: int,
    min_area: int,
    box_threshold: float,
) -> list[tuple[BoundingBox, float, str]]:
    settings = get_settings()
    import torch

    text = settings.grounding_dino_prompt
    inputs = _processor(images=img, text=text, return_tensors="pt")
    if settings.grounding_dino_device == "cuda" and torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    with torch.no_grad():
        outputs = _model(**inputs)

    target_sizes = torch.tensor([[h, w]])
    post_kwargs: dict = {"threshold": box_threshold, "target_sizes": target_sizes}
    try:
        results = _processor.post_process_grounded_object_detection(
            outputs,
            inputs["input_ids"],
            text_threshold=settings.grounding_dino_text_threshold,
            **post_kwargs,
        )[0]
    except TypeError:
        results = _processor.post_process_grounded_object_detection(
            outputs,
            inputs["input_ids"],
            **post_kwargs,
        )[0]

    raw_boxes: list[tuple[BoundingBox, float, str]] = []
    for box, score, label in zip(
        results["boxes"].tolist(),
        results["scores"].tolist(),
        results["labels"],
    ):
        x1, y1, x2, y2 = [int(round(v)) for v in box]
        bbox = BoundingBox(
            x1=max(0, min(x1, w)),
            y1=max(0, min(y1, h)),
            x2=max(0, min(x2, w)),
            y2=max(0, min(y2, h)),
        )
        if bbox.area < min_area:
            continue
        raw_boxes.append((bbox, float(score), str(label)))
    return raw_boxes


def _raw_boxes_from_local(img: Image.Image, w: int, h: int, min_area: int) -> list[tuple[BoundingBox, float, str]]:
    settings = get_settings()
    return _raw_boxes_from_local_at_threshold(
        img, w, h, min_area, settings.grounding_dino_threshold
    )


def detect_floor_plan_boxes(jpeg_bytes: bytes) -> tuple[list[tuple[BoundingBox, float, str]], str]:
    """
    Returns list of (bbox, confidence, label) and detection method used.
    """
    settings = get_settings()
    _ensure_model()

    img = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")
    w, h = img.size
    min_area = int(w * h * settings.detection_min_area_ratio)

    if not model_available():
        reason = _load_error
        if _backend() != "huggingface":
            from engines.detection import local_grounding_dino

            reason = local_grounding_dino.local_model_status().get("error")
        log.info("grounding_dino.fallback_full_page", reason=reason, backend=_backend())
        return (
            [(BoundingBox(0, 0, w, h), 1.0, "full page")],
            "full_page_fallback",
        )

    if _backend() == "huggingface":
        raw_boxes = _raw_boxes_from_hf(img, w, h, min_area)
    else:
        raw_boxes = _raw_boxes_from_local(img, w, h, min_area)

    if not raw_boxes and settings.grounding_dino_threshold > settings.grounding_dino_threshold_fallback:
        log.info(
            "grounding_dino.retry_lower_threshold",
            primary=settings.grounding_dino_threshold,
            fallback=settings.grounding_dino_threshold_fallback,
        )
        if _backend() == "huggingface":
            raw_boxes = _raw_boxes_from_hf_at_threshold(
                img, w, h, min_area, settings.grounding_dino_threshold_fallback
            )
        else:
            raw_boxes = _raw_boxes_from_local_at_threshold(
                img, w, h, min_area, settings.grounding_dino_threshold_fallback
            )

    if not raw_boxes:
        log.info("grounding_dino.no_detections", width=w, height=h, backend=_backend())
        return (
            [(BoundingBox(0, 0, w, h), 1.0, "full page")],
            "full_page_fallback",
        )

    nms_boxes = _nms(raw_boxes, settings.grounding_dino_nms_iou)
    refined = refine_floor_plan_boxes(jpeg_bytes, nms_boxes)

    page_area = w * h
    method = "grounding_dino"
    if len(refined) == 1 and refined[0][0].area >= page_area * 0.97:
        method = "full_page_fallback"

    return refined, method
