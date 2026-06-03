"""
providers/vision/openai.py — GPT-4o vision provider.
Implements the same VisionProvider interface as GeminiProvider.
"""
from __future__ import annotations

import base64

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, VisionProvider


class OpenAIProvider(VisionProvider):

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise ProviderError(
                code="MISSING_API_KEY",
                message="OPENAI_API_KEY is not set.",
            )
        import openai
        self._client = openai.OpenAI(api_key=settings.openai_api_key)
        self._model_name = settings.openai_model
        self._benchmark = settings.benchmark_mode

    @property
    def model_name(self) -> str:
        return self._model_name

    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(3),
        reraise=False,
    )
    def _call_with_retry(
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
        usage = response.usage

        return ProviderResponse(
            text=text.strip(),
            input_tokens=usage.prompt_tokens if usage else None,
            output_tokens=usage.completion_tokens if usage else None,
            model_used=self._model_name,
        )

    def analyze_image(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> ProviderResponse:
        try:
            return self._call_with_retry(image_bytes, mime_type, prompt)
        except Exception as exc:
            raise ProviderError(
                code="OPENAI_ERROR",
                message=f"OpenAI call failed after retries: {exc}",
                details={"model": self._model_name, "detail": str(exc)},
            ) from exc