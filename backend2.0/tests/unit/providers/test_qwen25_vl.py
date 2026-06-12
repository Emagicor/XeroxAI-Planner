from providers.vision.qwen25_vl import _extract_message_text


def test_extract_message_text_from_string():
    assert _extract_message_text('{"rooms": []}') == '{"rooms": []}'


def test_extract_message_text_from_parts():
    content = [{"type": "text", "text": "hello"}, {"type": "text", "text": " world"}]
    assert _extract_message_text(content) == "hello world"


def test_qwen25_vl_invalid_token():
    from providers.vision.errors import classify_qwen25_vl_error

    exc = Exception("401 Unauthorized")
    code, msg = classify_qwen25_vl_error(exc, model="Qwen/Qwen2.5-VL-7B-Instruct")
    assert code == "INVALID_API_KEY"
    assert msg == str(exc)


def test_qwen25_vl_router_migration_hint():
    from providers.vision.errors import classify_qwen25_vl_error

    exc = Exception("410 Gone — use router.huggingface.co")
    code, _msg = classify_qwen25_vl_error(exc, model="Qwen/Qwen2.5-VL-7B-Instruct")
    assert code == "QWEN25_VL_ERROR"
