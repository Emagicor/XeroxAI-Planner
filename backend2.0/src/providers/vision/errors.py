"""Classify vision provider failures for retry / user messaging."""
from __future__ import annotations

import re

_QUOTA_MARKERS = ("429", "quota", "rate limit", "resource_exhausted", "too many requests")
_TRANSIENT_MARKERS = ("503", "unavailable", "deadline", "timeout", "internal error")


def is_quota_exceeded(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(m in msg for m in _QUOTA_MARKERS)


def is_transient_error(exc: BaseException) -> bool:
    if is_quota_exceeded(exc):
        return False
    msg = str(exc).lower()
    return any(m in msg for m in _TRANSIENT_MARKERS)


def parse_retry_after_seconds(exc: BaseException) -> float | None:
    """Parse 'Please retry in 39.41s' from Gemini error text."""
    m = re.search(r"retry in ([\d.]+)\s*s", str(exc), re.IGNORECASE)
    if not m:
        return None
    try:
        return min(float(m.group(1)), 120.0)
    except ValueError:
        return None


def quota_user_message(model: str) -> str:
    return (
        f"Gemini API daily quota exceeded for model '{model}' on this Google Cloud project. "
        "Free tier is often ~20 requests/day per model. "
        "Wait for the limit to reset, enable billing in Google AI Studio, "
        "or set GEMINI_MODEL to a model you still have quota for (e.g. gemini-2.5-flash)."
    )
