from __future__ import annotations

import base64
import traceback

from annotations.renderer import draw_annotations
from config.constants import MAX_ANALYSIS_ATTEMPTS
from image.preprocess import preprocess_image
from prompts.floor_plan import CORRECTION_PROMPT_TEMPLATE, FLOOR_PLAN_PROMPT
from services.gemini import call_gemini, parse_gemini_json
from services.total_area import apply_total_area
from validators.analysis import validate_analysis_result


# ── single-page helpers ───────────────────────────────────────────────────────

def _analyze_two_pass(preprocessed_bytes: bytes, mime_type: str) -> dict:
    first_text = call_gemini(preprocessed_bytes, mime_type, FLOOR_PLAN_PROMPT)
    correction_prompt = CORRECTION_PROMPT_TEMPLATE.format(first_response=first_text)
    second_text = call_gemini(preprocessed_bytes, mime_type, correction_prompt)
    return parse_gemini_json(second_text)


def _analyze_single_page(image_bytes: bytes, mime_type: str) -> dict:
    preprocessed = preprocess_image(image_bytes)
    data = _analyze_two_pass(preprocessed, mime_type)
    data = apply_total_area(data)
    annotated_bytes = draw_annotations(image_bytes, data["rooms"])
    data["annotated_image"] = base64.b64encode(annotated_bytes).decode()
    return data


def _try_analyze_single_page(
    image_bytes: bytes,
    mime_type: str,
    max_attempts: int = MAX_ANALYSIS_ATTEMPTS,
) -> dict:
    """
    Retry wrapper for a single page.  Returns a result dict; on total failure
    returns an ineligible-page sentinel instead of raising.
    """
    last_error: Exception | None = None

    for _ in range(max_attempts):
        try:
            result = _analyze_single_page(image_bytes, mime_type)
            if validate_analysis_result(result):
                return result
            last_error = ValueError("Validation failed: invalid room data")
        except Exception as exc:  # noqa: BLE001
            last_error = exc

    # Surface as an ineligible page rather than crashing the whole document
    return {
        "eligible": False,
        "reason": str(last_error) if last_error else "Unknown analysis failure",
        "rooms": [],
        "total_area_sqft": 0,
        "total_area_source": "none",
        "overall_confidence": 0,
    }


# ── multi-page entry point ────────────────────────────────────────────────────

def analyze_pages(pages: list[tuple[bytes, str]]) -> dict:
    """
    Analyze every page independently.

    Args:
        pages: list of (image_bytes, mime_type) — one item per page

    Returns a document-level result::

        {
          "page_count": int,
          "pages": [
            {
              "page": 1,            # 1-based
              "eligible": true,
              "rooms": [...],
              "total_area_sqft": float,
              "total_area_source": "layout_dimensions" | "room_sum",
              "overall_confidence": int,
              "units_detected": str,
              "annotated_image": "<base64>",
              ...
            },
            {
              "page": 2,
              "eligible": false,
              "reason": "...",
              ...
            }
          ],
          "grand_total_sqft": float,
          "eligible_pages": int,
          "ineligible_pages": int,
        }
    """
    page_results: list[dict] = []
    grand_total = 0.0
    eligible_count = 0
    ineligible_count = 0

    for idx, (image_bytes, mime_type) in enumerate(pages, start=1):
        page_data = _try_analyze_single_page(image_bytes, mime_type)
        page_data["page"] = idx

        # If sentinel came back without explicit eligible key, mark it
        if "eligible" not in page_data:
            page_data["eligible"] = True

        if page_data.get("eligible", True):
            eligible_count += 1
            grand_total += float(page_data.get("total_area_sqft") or 0)
        else:
            ineligible_count += 1

        page_results.append(page_data)

    return {
        "page_count": len(pages),
        "pages": page_results,
        "grand_total_sqft": round(grand_total, 2),
        "eligible_pages": eligible_count,
        "ineligible_pages": ineligible_count,
    }


# ── legacy single-file shim (keeps old route working) ────────────────────────

def validate_and_retry(
    image_bytes: bytes,
    mime_type: str,
    max_attempts: int = MAX_ANALYSIS_ATTEMPTS,
) -> dict:
    result = _try_analyze_single_page(image_bytes, mime_type, max_attempts)
    if not result.get("eligible", True):
        raise ValueError(result.get("reason", "Analysis failed"))
    return result