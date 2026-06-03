"""
pipelines/extraction/page_analyzer.py

Two-pass vision (preprocessed JPEG), deterministic dimension cleanup,
annotations drawn on the same image the model saw, spec-based validation.
"""
from __future__ import annotations

import base64

import structlog

from config.settings import get_settings
from engines.area.total_area import apply_total_area
from engines.dimensions.sanitize import sanitize_vision_rooms
from engines.validation.analysis_validator import is_valid
from infrastructure.annotations.renderer import draw_annotations
from infrastructure.preprocessing.image_preprocessor import preprocess_image
from prompts.floor_plan import CORRECTION_PROMPT_TEMPLATE, FLOOR_PLAN_PROMPT
from providers.vision.base import VisionProvider
from providers.vision.gemini import parse_provider_json

log = structlog.get_logger(__name__)

# Preprocess always outputs JPEG — must match Gemini mime_type
VISION_MIME = "image/jpeg"


def _two_pass_analyze(
    provider: VisionProvider,
    preprocessed_bytes: bytes,
) -> dict:
    r1 = provider.analyze_image(preprocessed_bytes, VISION_MIME, FLOOR_PLAN_PROMPT)
    _log_usage(r1, pass_num=1)

    correction_prompt = CORRECTION_PROMPT_TEMPLATE.format(first_response=r1.text)
    r2 = provider.analyze_image(preprocessed_bytes, VISION_MIME, correction_prompt)
    _log_usage(r2, pass_num=2)

    return parse_provider_json(r2.text)


def _log_usage(response, pass_num: int) -> None:
    settings = get_settings()
    if settings.benchmark_mode:
        log.info(
            "provider.token_usage",
            pass_num=pass_num,
            model=response.model_used,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
        )


def _attach_annotated_image(display_bytes: bytes, data: dict) -> dict:
    """Draw overlays on the same raster the model analyzed (aligned 0–1000 coords)."""
    rooms = data.get("rooms") or []
    if not rooms:
        return data
    try:
        annotated_bytes = draw_annotations(display_bytes, rooms)
        return {
            **data,
            "annotated_image": base64.b64encode(annotated_bytes).decode("ascii"),
        }
    except Exception as exc:
        log.warning("page_analyzer.annotation_failed", error=str(exc), exc_info=True)
        return data


def analyze_single_page(
    provider: VisionProvider,
    image_bytes: bytes,
    mime_type: str,  # noqa: ARG001 — kept for API compatibility
) -> dict:
    preprocessed = preprocess_image(image_bytes)
    data = _two_pass_analyze(provider, preprocessed)
    data = sanitize_vision_rooms(data)
    data = apply_total_area(data)
    data = _attach_annotated_image(preprocessed, data)
    data["eligible"] = True
    return data


def analyze_page_safe(
    provider: VisionProvider,
    image_bytes: bytes,
    mime_type: str,
    page_number: int,
    max_attempts: int | None = None,
) -> dict:
    settings = get_settings()
    attempts = max_attempts or settings.max_analysis_attempts
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            result = analyze_single_page(provider, image_bytes, mime_type)

            if not is_valid(result):
                log.warning(
                    "page_analyzer.invalid_result",
                    page=page_number,
                    attempt=attempt,
                )
                last_error = ValueError("Model returned invalid room data")
                continue

            # Need at least one room with usable dimensions for a useful page
            measurable = [
                r for r in (result.get("rooms") or [])
                if r.get("area_sqft") and float(r["area_sqft"]) > 0
            ]
            if not measurable:
                last_error = ValueError("No rooms with computable dimensions")
                log.warning(
                    "page_analyzer.no_measurable_rooms",
                    page=page_number,
                    attempt=attempt,
                )
                continue

            log.info(
                "page_analyzer.success",
                page=page_number,
                attempt=attempt,
                has_annotation=bool(result.get("annotated_image")),
            )
            return result

        except Exception as exc:
            log.warning(
                "page_analyzer.attempt_failed",
                page=page_number,
                attempt=attempt,
                error=str(exc),
            )
            last_error = exc

    log.error(
        "page_analyzer.all_attempts_failed",
        page=page_number,
        error=str(last_error),
    )
    return {
        "eligible": False,
        "reason": str(last_error) if last_error else "Unknown analysis failure",
        "rooms": [],
        "total_area_sqft": 0.0,
        "total_area_source": "none",
        "overall_confidence": 0,
        "units_detected": "unknown",
    }
