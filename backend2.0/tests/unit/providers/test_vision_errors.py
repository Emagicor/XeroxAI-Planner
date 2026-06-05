from providers.vision.errors import is_quota_exceeded, is_transient_error, parse_retry_after_seconds


def test_quota_detection():
    exc = Exception("429 quota exceeded for free_tier_requests")
    assert is_quota_exceeded(exc)
    assert not is_transient_error(exc)


def test_transient_not_quota():
    exc = Exception("503 service unavailable")
    assert is_transient_error(exc)
    assert not is_quota_exceeded(exc)


def test_parse_retry_delay():
    exc = Exception("Please retry in 39.41319235s.")
    assert parse_retry_after_seconds(exc) == 39.41319235
