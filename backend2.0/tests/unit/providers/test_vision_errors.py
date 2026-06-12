from providers.vision.errors import (
    classify_florence2_error,
    classify_gemini_error,
    classify_openai_compatible_error,
    is_billing_credits_depleted,
    is_quota_exceeded,
    is_transient_error,
    parse_retry_after_seconds,
)


def test_quota_detection():
    exc = Exception("429 quota exceeded for free_tier_requests")
    assert is_quota_exceeded(exc)
    assert not is_transient_error(exc)


def test_prepaid_depleted_not_generic_quota():
    exc = Exception(
        "429 Your prepayment credits are depleted. Please go to AI Studio..."
    )
    assert is_billing_credits_depleted(exc)
    assert not is_quota_exceeded(exc)
    code, msg = classify_gemini_error(exc, model="gemini-2.5-flash")
    assert code == "BILLING_CREDITS_DEPLETED"
    assert "prepaid credits" in msg.lower()


def test_transient_not_quota():
    exc = Exception("503 service unavailable")
    assert is_transient_error(exc)
    assert not is_quota_exceeded(exc)


def test_parse_retry_delay():
    exc = Exception("Please retry in 39.41319235s.")
    assert parse_retry_after_seconds(exc) == 39.41319235


def test_gemini_quota_returns_raw_api_message():
    exc = Exception("429 quota exceeded for free_tier_requests")
    code, msg = classify_gemini_error(exc, model="gemini-2.5-flash")
    assert code == "QUOTA_EXCEEDED"
    assert msg == str(exc)


def test_openai_invalid_key_returns_raw():
    exc = Exception("401 invalid api key")
    code, msg = classify_openai_compatible_error(exc, provider="openai", model="gpt-4o")
    assert code == "INVALID_API_KEY"
    assert msg == str(exc)


def test_groq_quota_returns_raw():
    exc = Exception("429 rate limit exceeded")
    code, msg = classify_openai_compatible_error(
        exc, provider="groq", model="meta-llama/llama-4-scout-17b-16e-instruct"
    )
    assert code == "QUOTA_EXCEEDED"
    assert msg == str(exc)


def test_openai_unknown_error_returns_raw():
    exc = Exception("upstream connect error")
    code, msg = classify_openai_compatible_error(exc, provider="openai", model="gpt-4o")
    assert code == "OPENAI_ERROR"
    assert msg == "upstream connect error"


def test_florence2_missing_deps_returns_raw():
    exc = Exception("No module named 'transformers'")
    code, msg = classify_florence2_error(exc, model="microsoft/Florence-2-large")
    assert code == "FLORENCE2_ERROR"
    assert msg == str(exc)


def test_florence2_oom_returns_raw():
    exc = Exception("CUDA out of memory")
    code, msg = classify_florence2_error(exc, model="microsoft/Florence-2-large")
    assert code == "FLORENCE2_ERROR"
    assert msg == "CUDA out of memory"


def test_provider_failure_codes():
    from providers.vision.errors import PROVIDER_FAILURE_CODES, is_provider_failure_code

    assert is_provider_failure_code("GEMINI_ERROR")
    assert is_provider_failure_code("FLORENCE2_ERROR")
    assert is_provider_failure_code("QUOTA_EXCEEDED")
    assert not is_provider_failure_code("INTERNAL_ERROR")
    assert "GEMINI_ERROR" in PROVIDER_FAILURE_CODES
