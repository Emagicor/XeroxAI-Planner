from providers.vision.gemini_usage import parse_gemini_usage_metadata


class _FakeUsage:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def test_reads_explicit_thoughts_token_count():
    meta = _FakeUsage(
        prompt_token_count=9,
        candidates_token_count=23,
        thoughts_token_count=444,
        total_token_count=476,
    )
    usage = parse_gemini_usage_metadata(meta)
    assert usage.prompt_token_count == 9
    assert usage.candidates_token_count == 23
    assert usage.thoughts_token_count == 444
    assert usage.total_token_count == 476


def test_derives_thoughts_when_sdk_omits_field():
    meta = _FakeUsage(
        prompt_token_count=2160,
        candidates_token_count=1573,
        total_token_count=6229,
    )
    usage = parse_gemini_usage_metadata(meta)
    assert usage.thoughts_token_count == 2496
    assert usage.as_log_fields()["thoughtsTokenCount"] == 2496


def test_zero_thoughts_when_total_equals_prompt_plus_candidates():
    meta = _FakeUsage(
        prompt_token_count=100,
        candidates_token_count=50,
        total_token_count=150,
    )
    usage = parse_gemini_usage_metadata(meta)
    assert usage.thoughts_token_count == 0
