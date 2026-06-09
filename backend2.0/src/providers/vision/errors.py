"""Classify vision provider failures for retry / user messaging."""
from __future__ import annotations

import re

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
    if is_quota_exceeded(exc) or is_billing_credits_depleted(exc):
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
        f"Gemini API rate limit or quota hit for model '{model}'. "
        "Wait a few minutes, check usage in Google AI Studio, "
        "or set GEMINI_MODEL to a model with available quota (e.g. gemini-2.5-flash)."
    )


def classify_gemini_error(exc: BaseException, *, model: str) -> tuple[str, str]:
    """Return (error_code, user_message) for a Gemini API failure."""
    if is_billing_credits_depleted(exc):
        return (
            "BILLING_CREDITS_DEPLETED",
            "Gemini prepaid credits are depleted for this Google Cloud project. "
            "Add credits in AI Studio → your project → Billing: "
            "https://ai.google.dev/gemini-api/docs/billing#prepay",
        )
    if is_invalid_api_key(exc):
        return (
            "INVALID_API_KEY",
            "GEMINI_API_KEY is invalid or not enabled for the Gemini API. "
            "Create a new key in AI Studio and update backend2.0/.env, then restart the server.",
        )
    if is_model_not_found(exc):
        return (
            "MODEL_NOT_FOUND",
            f"Model '{model}' is not available for your API key. "
            "Set GEMINI_MODEL=gemini-2.5-flash in backend2.0/.env and restart the server.",
        )
    if is_quota_exceeded(exc):
        return ("QUOTA_EXCEEDED", quota_user_message(model))
    return ("GEMINI_ERROR", str(exc))
