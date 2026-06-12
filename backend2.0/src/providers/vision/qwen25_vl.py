"""
providers/vision/qwen25_vl.py — Qwen2.5-VL via Hugging Face Inference API (cloud).

Uses OpenAI-compatible chat_completion with image_url + text, same shape as
OpenAI/Groq. Supports HF Inference Providers (auto/fireworks-ai/together/…)
or a self-hosted vLLM/TGI endpoint via QWEN25_VL_BASE_URL.
"""
from __future__ import annotations

import base64

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, TokenUsage, VisionProvider
from providers.vision.errors import classify_qwen25_vl_error
from providers.vision.retry import call_with_transient_retry

_DEFAULT_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct"


def _extract_message_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text))
        return "".join(parts).strip()
    return str(content).strip()


def _build_inference_client(*, hf_token: str, base_url: str, provider: str):
    try:
        from huggingface_hub import InferenceClient
    except ImportError as exc:
        raise ProviderError(
            code="QWEN25_VL_ERROR",
            message="huggingface_hub is not installed. Run: pip install huggingface_hub",
            details={"detail": str(exc)[:400]},
        ) from exc

    kwargs: dict = {"api_key": hf_token}
    if base_url:
        kwargs["base_url"] = base_url.rstrip("/")
    elif provider and provider.lower() != "auto":
        kwargs["provider"] = provider
    return InferenceClient(**kwargs)


class Qwen25VLProvider(VisionProvider):

    def __init__(self, *, model: str | None = None) -> None:
        settings = get_settings()
        if not settings.huggingface_token:
            raise ProviderError(
                code="MISSING_API_KEY",
                message=(
                    "HUGGINGFACE_TOKEN is not set. "
                    "Create a token at https://huggingface.co/settings/tokens "
                    "with Inference Providers access."
                ),
            )
        self._model_name = model or settings.qwen25_vl_model or _DEFAULT_MODEL
        self._hf_token = settings.huggingface_token
        self._base_url = (settings.qwen25_vl_base_url or "").strip()
        self._inference_provider = (settings.qwen25_vl_inference_provider or "auto").strip()
        self._max_tokens = max(256, settings.qwen25_vl_max_tokens)
        self._transient_retries = max(0, settings.qwen25_vl_transient_retries)

    @property
    def model_name(self) -> str:
        return self._model_name

    def _call_once(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> ProviderResponse:
        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:{mime_type};base64,{b64}"

        client = _build_inference_client(
            hf_token=self._hf_token,
            base_url=self._base_url,
            provider=self._inference_provider,
        )

        response = client.chat_completion(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                }
            ],
            model=self._model_name,
            max_tokens=self._max_tokens,
            temperature=0,
        )

        if not response.choices:
            raise ProviderError(
                code="QWEN25_VL_ERROR",
                message="Qwen2.5-VL returned no choices.",
                details={"model": self._model_name},
            )

        text = _extract_message_text(response.choices[0].message.content)

        usage = None
        api_usage = getattr(response, "usage", None)
        if api_usage is not None:
            usage = TokenUsage(
                prompt_token_count=getattr(api_usage, "prompt_tokens", None),
                candidates_token_count=getattr(api_usage, "completion_tokens", None),
                total_token_count=getattr(api_usage, "total_tokens", None),
            )

        return ProviderResponse(
            text=text,
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
            model_used=self._model_name,
            usage=usage,
        )

    def _raise_provider_error(self, exc: Exception) -> None:
        code, message = classify_qwen25_vl_error(exc, model=self._model_name)
        raise ProviderError(
            code=code,
            message=message,
            details={"model": self._model_name, "detail": str(exc)[:400]},
        ) from exc

    def analyze_image(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> ProviderResponse:
        return call_with_transient_retry(
            lambda: self._call_once(image_bytes, mime_type, prompt),
            transient_retries=self._transient_retries,
            on_error=self._raise_provider_error,
        )
