"""
pipelines/extraction/page_analyzer.py

Two-pass vision (preprocessed JPEG), deterministic dimension cleanup,
annotations drawn on the same image the model saw, spec-based validation.
"""
from __future__ import annotations

import base64
import gc

import structlog

from config.settings import get_settings
from domain.exceptions import ProviderError
from engines.area.total_area import apply_total_area
from engines.dimensions.sanitize import sanitize_vision_rooms
from engines.validation.analysis_validator import is_valid
from infrastructure.annotations.renderer import draw_annotations
from infrastructure.preprocessing.image_preprocessor import preprocess_image
from infrastructure.vision_session import VISION_API_LOCK
from prompts.floor_plan import isolated_correction_prompt, isolated_floor_plan_prompt
from providers.vision.base import VisionProvider
from providers.vision.factory import create_vision_provider
from providers.vision.gemini import parse_provider_json

log = structlog.get_logger(__name__)

VISION_MIME = "image/jpeg"

_NON_PLAN_PAGE_TYPES = frozenset(
    {"cover", "notes", "schedule", "elevation", "section", "other", "title", "text", "index"}
)


def _vision_rejects_page(data: dict) -> str | None:
    pc = data.get("page_classification") or {}
    if pc.get("is_floor_plan") is False:
        return pc.get("reason") or "Vision model: not a floor plan page"

    page_type = str(pc.get("page_type") or "").lower()
    if page_type in _NON_PLAN_PAGE_TYPES:
        return pc.get("reason") or f"Vision model: page type '{page_type}'"

    return None


def _ineligible_payload(reason: str, data: dict | None = None) -> dict:
    pc = (data or {}).get("page_classification") or {}
    return {
        "eligible": False,
        "reason": reason,
        "page_classification": pc,
        "rooms": [],
        "total_area_sqft": 0.0,
        "total_area_source": "none",
        "overall_confidence": 0,
        "units_detected": "unknown",
    }


def _result_needs_correction(data: dict) -> bool:
    """True when a second vision call may fix empty/invalid extraction."""
    if _vision_rejects_page(data):
        return False
    if not is_valid(data):
        return True
    measurable = [
        r for r in (data.get("rooms") or [])
        if r.get("area_sqft") and float(r["area_sqft"]) > 0
    ]
    return not measurable


def _vision_analyze(
    provider: VisionProvider,
    preprocessed_bytes: bytes,
    *,
    session_id: str,
    page_number: int,
) -> dict:
    """
    Run 1–2 Gemini calls per page (settings-controlled):
      - Default: 1 call; optional correction pass only if pass-1 is weak.
      - vision_two_pass=true: always 2 calls (legacy quality mode).
    """
    settings = get_settings()
    prompt1 = isolated_floor_plan_prompt(session_id, page_number)
    api_calls = 0

    with VISION_API_LOCK:
        r1 = provider.analyze_image(preprocessed_bytes, VISION_MIME, prompt1)
        api_calls += 1
        _log_usage(r1, pass_num=1)

        data = parse_provider_json(r1.text)
        run_correction = settings.vision_two_pass
        if not run_correction and settings.vision_correction_pass:
            run_correction = _result_needs_correction(data)

        if run_correction:
            correction_prompt = isolated_correction_prompt(
                session_id, page_number, r1.text
            )
            r2 = provider.analyze_image(
                preprocessed_bytes, VISION_MIME, correction_prompt
            )
            api_calls += 1
            _log_usage(r2, pass_num=2)
            data = parse_provider_json(r2.text)

    log.info(
        "page_analyzer.vision_calls",
        page=page_number,
        api_calls=api_calls,
        two_pass=settings.vision_two_pass,
        correction_pass=settings.vision_correction_pass,
    )
    return data


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
    mime_type: str,  # noqa: ARG001
    *,
    session_id: str,
    page_number: int,
) -> dict:
    preprocessed = preprocess_image(bytes(image_bytes))
    data = _vision_analyze(
        provider,
        preprocessed,
        session_id=session_id,
        page_number=page_number,
    )

    reject_reason = _vision_rejects_page(data)
    if reject_reason:
        log.info("page_analyzer.rejected_non_plan", reason=reject_reason)
        return _ineligible_payload(reject_reason, data)

    data = sanitize_vision_rooms(data)
    data = apply_total_area(data)
    data = _attach_annotated_image(preprocessed, data)
    data["eligible"] = True
    return data


def analyze_page_safe(
    provider: VisionProvider | None,
    image_bytes: bytes,
    mime_type: str,
    page_number: int,
    max_attempts: int | None = None,
    *,
    session_id: str,
) -> dict:
    settings = get_settings()
    attempts = max_attempts or settings.max_analysis_attempts
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        vision = provider or create_vision_provider()
        try:
            result = analyze_single_page(
                vision,
                image_bytes,
                mime_type,
                session_id=session_id,
                page_number=page_number,
            )

            if not result.get("eligible", True):
                log.info(
                    "page_analyzer.skipped",
                    page=page_number,
                    reason=result.get("reason"),
                )
                return result

            if not is_valid(result):
                log.warning(
                    "page_analyzer.invalid_result",
                    page=page_number,
                    attempt=attempt,
                )
                last_error = ValueError("Model returned invalid room data")
                continue

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
                session_id=session_id,
                has_annotation=bool(result.get("annotated_image")),
            )
            return result

        except ProviderError as exc:
            # Quota / auth — do not burn more API calls retrying the page
            if exc.code in ("QUOTA_EXCEEDED", "MISSING_API_KEY"):
                raise
            log.warning(
                "page_analyzer.provider_error",
                page=page_number,
                attempt=attempt,
                code=exc.code,
                error=exc.message,
            )
            last_error = exc
        except Exception as exc:
            log.warning(
                "page_analyzer.attempt_failed",
                page=page_number,
                attempt=attempt,
                error=str(exc),
            )
            last_error = exc
        finally:
            del vision
            gc.collect()

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
