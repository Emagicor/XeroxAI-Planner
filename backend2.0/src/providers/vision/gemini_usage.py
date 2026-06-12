"""Parse Gemini usageMetadata — SDK proto may omit thoughtsTokenCount."""
from __future__ import annotations

import structlog

from providers.vision.base import TokenUsage

log = structlog.get_logger(__name__)


def _coerce_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _read_int(meta, *attr_names: str) -> int | None:
    for name in attr_names:
        if hasattr(meta, name):
            val = _coerce_int(getattr(meta, name, None))
            if val is not None:
                return val
    return None


def parse_gemini_usage_metadata(meta) -> TokenUsage | None:
    """
    Map Gemini usageMetadata to TokenUsage.

    google-generativeai 0.8.x protos expose prompt/candidates/total only.
    Newer API JSON also returns thoughtsTokenCount; when the SDK omits it,
    derive: total - prompt - candidates - cached - tool_use.
    """
    if meta is None:
        return None

    prompt = _read_int(meta, "prompt_token_count", "promptTokenCount")
    candidates = _read_int(meta, "candidates_token_count", "candidatesTokenCount")
    total = _read_int(meta, "total_token_count", "totalTokenCount")
    thoughts = _read_int(meta, "thoughts_token_count", "thoughtsTokenCount")
    cached = _read_int(meta, "cached_content_token_count", "cachedContentTokenCount") or 0
    tool_use = _read_int(
        meta, "tool_use_prompt_token_count", "toolUsePromptTokenCount"
    ) or 0

    if thoughts is None and total is not None and prompt is not None and candidates is not None:
        remainder = total - prompt - candidates - cached - tool_use
        if remainder > 0:
            thoughts = remainder
            log.debug(
                "gemini_usage.derived_thoughts_token_count",
                promptTokenCount=prompt,
                candidatesTokenCount=candidates,
                totalTokenCount=total,
                thoughtsTokenCount=thoughts,
            )
        elif remainder == 0:
            thoughts = 0
        else:
            log.warning(
                "gemini_usage.token_sum_mismatch",
                promptTokenCount=prompt,
                candidatesTokenCount=candidates,
                totalTokenCount=total,
                cachedContentTokenCount=cached,
                toolUsePromptTokenCount=tool_use,
                remainder=remainder,
            )

    if all(v is None for v in (prompt, candidates, thoughts, total)):
        return None

    return TokenUsage(
        prompt_token_count=prompt,
        candidates_token_count=candidates,
        thoughts_token_count=thoughts,
        total_token_count=total,
    )
