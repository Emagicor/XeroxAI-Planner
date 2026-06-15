"""
pipelines/extraction/page_analyzer.py

Two-pass vision (preprocessed JPEG), deterministic dimension cleanup,
spec-based validation.
"""
from __future__ import annotations

import structlog

from config.settings import get_settings
from domain.exceptions import ProviderError
from engines.area.total_area import apply_total_area
from engines.confidence.correction_targets import (
    build_correction_targets,
    merge_corrections,
)
from engines.dimensions.sanitize import sanitize_vision_rooms
from engines.validation.analysis_validator import is_valid
from infrastructure.preprocessing.image_preprocessor import preprocess_image
from infrastructure.vision_prompt_logger import log_vision_pass_output
from infrastructure.vision_session import VISION_API_LOCK
from prompts.floor_plan import (
    isolated_correction_prompt,
    isolated_floor_plan_prompt,
    isolated_selective_correction_prompt,
)
from providers.vision.base import VisionProvider
from providers.vision.base import TokenUsage
from domain.entities.vision_usage import VisionPassRecord, VisionUsageSnapshot
from providers.vision.factory import (
    create_correction_validator,
    create_vision_provider,
    resolve_correction_provider_model,
    resolve_extraction_provider,
)
from providers.vision.request_config import VisionOverride
from providers.vision.json_parse import parse_provider_json

log = structlog.get_logger(__name__)

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


def _has_measurable_rooms(data: dict) -> bool:
    return bool([
        r for r in (data.get("rooms") or [])
        if r.get("area_sqft") and float(r["area_sqft"]) > 0
    ])


def _needs_structural_correction(data: dict) -> bool:
    """True when pass-1 JSON is empty/invalid — rare fallback to full correction."""
    if _vision_rejects_page(data):
        return False
    sanitized = sanitize_vision_rooms(data)
    if not is_valid(sanitized):
        return True
    return not _has_measurable_rooms(sanitized)


def _should_run_correction(data: dict, settings) -> bool:
    if not (settings.vision_two_pass or settings.vision_correction_pass):
        return False
    if _needs_structural_correction(data):
        return True
    if _vision_rejects_page(data):
        return False
    # Valid floor plan: always run pass 2 to scan for rooms missed by pass 1.
    if settings.vision_correction_pass:
        return True
    targets = build_correction_targets(
        data,
        threshold=settings.vision_correction_confidence_max,
    )
    return targets.has_targets


def _correction_fields_payload(
    *,
    correction_mode: str,
    targets,
    pass1_text: str | None = None,
) -> dict:
    """Describe pass-2 payload without embedding full pass-1 raw text."""
    if correction_mode == "full_fallback":
        return {
            "mode": "full_fallback",
            "includes_pass1_raw_text": True,
            "pass1_text_length": len(pass1_text or ""),
        }
    return targets.to_prompt_payload()


def _vision_analyze(
    provider: VisionProvider,
    preprocessed_bytes: bytes,
    vision_mime: str,
    *,
    session_id: str,
    page_number: int,
    vision_override: VisionOverride | None = None,
) -> tuple[dict, VisionUsageSnapshot]:
    """
    Run 1–2 vision calls per page (settings-controlled):
      - Pass 1: full floor-plan extraction.
      - Pass 2 (selective): only low-confidence rooms/fields from pass 1.
      - Skips pass 2 when every room is high-confidence measured (saves tokens).
    """
    settings = get_settings()
    prompt1 = isolated_floor_plan_prompt(session_id, page_number)
    api_calls = 0
    page_usage = TokenUsage()
    pass_records: list[VisionPassRecord] = []
    extraction_provider = resolve_extraction_provider(vision_override)

    with VISION_API_LOCK:
        r1 = provider.analyze_image(preprocessed_bytes, vision_mime, prompt1)
        api_calls += 1
        page_usage = page_usage.add(r1.usage)
        pass_records.append(
            VisionPassRecord(
                pass_number=1,
                pass_kind="extraction",
                provider=extraction_provider,
                model=r1.model_used,
                usage=r1.usage or TokenUsage(),
                page_number=page_number,
            )
        )
        _log_usage(r1, pass_num=1, page_number=page_number)
        log_vision_pass_output(
            pass_kind="floor_plan",
            raw_text=r1.text,
            session_id=session_id,
            page_number=page_number,
            model=r1.model_used,
        )

        data = parse_provider_json(r1.text)
        run_correction = _should_run_correction(data, settings)

        if run_correction:
            threshold = settings.vision_correction_confidence_max
            structural = _needs_structural_correction(data)
            targets = build_correction_targets(
                data,
                threshold=threshold,
                include_all_rooms=structural,
            )

            if structural and not targets.has_targets:
                correction_prompt = isolated_correction_prompt(
                    session_id, page_number, r1.text
                )
                correction_mode = "full_fallback"
            else:
                correction_prompt = isolated_selective_correction_prompt(
                    session_id, page_number, targets
                )
                correction_mode = "selective"

            correction_provider, correction_model_config = resolve_correction_provider_model(
                vision_override
            )
            validator = create_correction_validator(vision_override)
            r2 = validator.analyze_image(
                preprocessed_bytes, vision_mime, correction_prompt
            )
            api_calls += 1
            page_usage = page_usage.add(r2.usage)
            pass_records.append(
                VisionPassRecord(
                    pass_number=2,
                    pass_kind="correction",
                    provider=correction_provider,
                    model=r2.model_used or correction_model_config,
                    usage=r2.usage or TokenUsage(),
                    page_number=page_number,
                    correction_mode=correction_mode,
                    correction_fields=_correction_fields_payload(
                        correction_mode=correction_mode,
                        targets=targets,
                        pass1_text=r1.text if correction_mode == "full_fallback" else None,
                    ),
                )
            )
            _log_usage(r2, pass_num=2, page_number=page_number)
            log_vision_pass_output(
                pass_kind="correction",
                raw_text=r2.text,
                session_id=session_id,
                page_number=page_number,
                model=r2.model_used,
            )
            correction_data = parse_provider_json(r2.text)
            log.info(
                "page_analyzer.correction_pass",
                page=page_number,
                model=r2.model_used,
                mode=correction_mode,
                target_rooms=len(targets.rooms),
                rooms_added=len(correction_data.get("rooms_added") or []),
            )
            if correction_mode == "selective":
                data = merge_corrections(data, correction_data)
            else:
                data = correction_data

    log.info(
        "page_analyzer.vision_calls",
        page=page_number,
        api_calls=api_calls,
        two_pass=settings.vision_two_pass,
        correction_pass=settings.vision_correction_pass,
    )
    if any(v is not None for v in page_usage.as_log_fields().values()):
        log.info(
            "page_analyzer.token_usage",
            page=page_number,
            session_id=session_id,
            api_calls=api_calls,
            **page_usage.as_log_fields(),
        )
    usage_snapshot = VisionUsageSnapshot(
        passes=pass_records,
        totals=page_usage,
        api_calls=api_calls,
        page_number=page_number,
    )
    return data, usage_snapshot


def _log_usage(response, pass_num: int, *, page_number: int) -> None:
    usage = response.usage
    if usage is None:
        return

    log.info(
        "provider.token_usage",
        page=page_number,
        pass_num=pass_num,
        model=response.model_used,
        **usage.as_log_fields(),
    )


def analyze_single_page(
    provider: VisionProvider,
    image_bytes: bytes,
    mime_type: str,  # noqa: ARG001
    *,
    session_id: str,
    page_number: int,
    from_pdf: bool = False,
    vision_override: VisionOverride | None = None,
) -> tuple[dict, VisionUsageSnapshot]:
    preprocessed, vision_mime = preprocess_image(
        bytes(image_bytes),
        preserve_colors=from_pdf,
    )
    data, usage_snapshot = _vision_analyze(
        provider,
        preprocessed,
        vision_mime,
        session_id=session_id,
        page_number=page_number,
        vision_override=vision_override,
    )

    reject_reason = _vision_rejects_page(data)
    if reject_reason:
        log.info("page_analyzer.rejected_non_plan", reason=reject_reason)
        return _ineligible_payload(reject_reason, data), usage_snapshot

    data = sanitize_vision_rooms(data)
    data = apply_total_area(data)
    data["eligible"] = True
    return data, usage_snapshot


def analyze_page_safe(
    provider: VisionProvider | None,
    image_bytes: bytes,
    mime_type: str,
    page_number: int,
    max_attempts: int | None = None,
    *,
    session_id: str,
    from_pdf: bool = False,
    vision_override: VisionOverride | None = None,
) -> tuple[dict, VisionUsageSnapshot | None]:
    settings = get_settings()
    attempts = max_attempts or settings.max_analysis_attempts
    last_error: Exception | None = None
    accumulated_usage: VisionUsageSnapshot | None = None

    for attempt in range(1, attempts + 1):
        vision = provider or create_vision_provider(vision_override)
        try:
            result, page_usage = analyze_single_page(
                vision,
                image_bytes,
                mime_type,
                session_id=session_id,
                page_number=page_number,
                from_pdf=from_pdf,
                vision_override=vision_override,
            )
            accumulated_usage = (
                accumulated_usage.merge(page_usage) if accumulated_usage else page_usage
            )

            if not result.get("eligible", True):
                log.info(
                    "page_analyzer.skipped",
                    page=page_number,
                    reason=result.get("reason"),
                )
                return result, accumulated_usage

            if not is_valid(result):
                log.warning(
                    "page_analyzer.invalid_result",
                    page=page_number,
                    attempt=attempt,
                )
                last_error = ValueError("Model returned invalid room data")
                continue

            if not _has_measurable_rooms(result):
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
            )
            return result, accumulated_usage

        except ProviderError as exc:
            if exc.code == "JSON_PARSE_ERROR" and attempt < attempts:
                log.warning(
                    "page_analyzer.json_parse_retry",
                    page=page_number,
                    attempt=attempt,
                    error=exc.message,
                )
                last_error = exc
                continue
            raise
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
    }, accumulated_usage
