"""
providers/vision/groq.py — Groq vision provider (OpenAI-compatible API).
"""
from __future__ import annotations

import base64

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, TokenUsage, VisionProvider
from providers.vision.errors import classify_openai_compatible_error
from providers.vision.retry import call_with_transient_retry

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqProvider(VisionProvider):

    def __init__(self, *, model: str | None = None) -> None:
        settings = get_settings()
        if not settings.groq_api_key:
            raise ProviderError(
                code="MISSING_API_KEY",
                message="GROQ_API_KEY is not set.",
            )
        import openai

        self._client = openai.OpenAI(
            api_key=settings.groq_api_key,
            base_url=GROQ_BASE_URL,
        )
        self._model_name = model or settings.groq_model
        self._transient_retries = 0

    @property
    def model_name(self) -> str:
        return self._model_name

    def _call_once(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> ProviderResponse:
        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:{mime_type};base64,{b64}"

        response = self._client.chat.completions.create(
            model=self._model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                    ],
                }
            ],
            max_tokens=4096,
        )

        text = response.choices[0].message.content or ""
        api_usage = response.usage
        usage = None
        if api_usage:
            usage = TokenUsage(
                prompt_token_count=api_usage.prompt_tokens,
                candidates_token_count=api_usage.completion_tokens,
                total_token_count=api_usage.total_tokens,
            )

        return ProviderResponse(
            text=text.strip(),
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
            model_used=self._model_name,
            usage=usage,
        )

    def _raise_provider_error(self, exc: Exception) -> None:
        code, message = classify_openai_compatible_error(
            exc, provider="groq", model=self._model_name
        )
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
