import base64

from annotations.renderer import draw_annotations
from config.constants import MAX_ANALYSIS_ATTEMPTS
from image.preprocess import preprocess_image
from prompts.floor_plan import CORRECTION_PROMPT_TEMPLATE, FLOOR_PLAN_PROMPT
from services.gemini import call_gemini, parse_gemini_json
from services.total_area import apply_total_area
from validators.analysis import validate_analysis_result


def analyze_two_pass(preprocessed_bytes: bytes, mime_type: str) -> dict:
    first_text = call_gemini(preprocessed_bytes, mime_type, FLOOR_PLAN_PROMPT)
    correction_prompt = CORRECTION_PROMPT_TEMPLATE.format(first_response=first_text)
    second_text = call_gemini(preprocessed_bytes, mime_type, correction_prompt)
    return parse_gemini_json(second_text)


def analyze_floor_plan(image_bytes: bytes, mime_type: str) -> dict:
    preprocessed = preprocess_image(image_bytes)
    data = analyze_two_pass(preprocessed, mime_type)
    data = apply_total_area(data)
    annotated_bytes = draw_annotations(image_bytes, data["rooms"])
    data["annotated_image"] = base64.b64encode(annotated_bytes).decode()
    return data


def validate_and_retry(
    image_bytes: bytes,
    mime_type: str,
    max_attempts: int = MAX_ANALYSIS_ATTEMPTS,
) -> dict:
    last_error = None

    for _ in range(max_attempts):
        try:
            result = analyze_floor_plan(image_bytes, mime_type)
            if validate_analysis_result(result):
                return result
            last_error = ValueError("Validation failed: invalid room data")
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error

    raise ValueError("Analysis failed after retries")
