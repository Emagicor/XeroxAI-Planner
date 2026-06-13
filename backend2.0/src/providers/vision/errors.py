"""Classify vision provider failures for retry / user messaging."""
from __future__ import annotations

import re

PROVIDER_FAILURE_CODES = frozenset({
    "MISSING_API_KEY",
    "INVALID_API_KEY",
    "QUOTA_EXCEEDED",
    "BILLING_CREDITS_DEPLETED",
    "MODEL_NOT_FOUND",
    "GEMINI_ERROR",
    "OPENAI_ERROR",
    "GROQ_ERROR",
    "VISION_PROVIDER_ERROR",
    "JSON_PARSE_ERROR",
})

_QUOTA_MARKERS = ("429", "quota", "rate limit", "resource_exhausted", "too many requests")
_TRANSIENT_MARKERS = ("503", "unavailable", "deadline", "timeout", "internal error")
_BILLING_MARKERS = ("prepayment credits are depleted", "prepay", "billing")


def is_quota_exceeded(exc: BaseException) -> bool:
    msg = str(exc).lower()
    if is_billing_credits_depleted(exc):
        return False
    return any(m in msg for m in _QUOTA_MARKERS)


def is_billing_credits_depleted(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "prepayment credits are depleted" in msg or (
        "prepay" in msg and "deplet" in msg
    )


def is_invalid_api_key(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return (
        "api key not valid" in msg
        or "api_key_invalid" in msg
        or "invalid api key" in msg
        or ("permission denied" in msg and "api" in msg)
    )


def is_model_not_found(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "not found" in msg and ("model" in msg or "models/" in msg)


def is_transient_error(exc: BaseException) -> bool:
    if is_fail_fast_error(exc):
        return False
    msg = str(exc).lower()
    return any(m in msg for m in _TRANSIENT_MARKERS)


def is_fail_fast_error(exc: BaseException) -> bool:
    """Quota, auth, billing, and model errors — never retry or sleep."""
    return (
        is_quota_exceeded(exc)
        or is_billing_credits_depleted(exc)
        or is_invalid_api_key(exc)
        or is_model_not_found(exc)
    )


def is_provider_failure_code(code: str | None) -> bool:
    return bool(code and code in PROVIDER_FAILURE_CODES)


def parse_retry_after_seconds(exc: BaseException) -> float | None:
    """Parse 'Please retry in 39.41s' from Gemini error text."""
    m = re.search(r"retry in ([\d.]+)\s*s", str(exc), re.IGNORECASE)
    if not m:
        return None
    try:
        return min(float(m.group(1)), 120.0)
    except ValueError:
        return None


def classify_gemini_error(exc: BaseException, *, model: str) -> tuple[str, str]:
    """Return (error_code, message). Message is always the provider's raw error text."""
    raw = str(exc).strip()
    if is_billing_credits_depleted(exc):
        return ("BILLING_CREDITS_DEPLETED", raw)
    if is_invalid_api_key(exc):
        return ("INVALID_API_KEY", raw)
    if is_model_not_found(exc):
        return ("MODEL_NOT_FOUND", raw)
    if is_quota_exceeded(exc):
        return ("QUOTA_EXCEEDED", raw)
    return ("GEMINI_ERROR", raw)


def classify_openai_compatible_error(
    exc: BaseException,
    *,
    provider: str,
    model: str,
) -> tuple[str, str]:
    """Return (error_code, message). Message is always the provider's raw error text."""
    provider_key = provider.lower()
    fallback_code = (
        f"{provider_key.upper()}_ERROR"
        if provider_key in ("openai", "groq")
        else "VISION_PROVIDER_ERROR"
    )
    raw = str(exc).strip()

    if is_invalid_api_key(exc):
        return ("INVALID_API_KEY", raw)
    if is_model_not_found(exc):
        return ("MODEL_NOT_FOUND", raw)
    if is_quota_exceeded(exc):
        return ("QUOTA_EXCEEDED", raw)

    return (fallback_code, raw)
