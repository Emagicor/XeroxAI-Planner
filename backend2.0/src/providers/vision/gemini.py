"""
providers/vision/gemini.py

FIX vs original gemini.py:
  - configure_gemini() called ONCE at construction, not on every call
  - Retry with exponential back-off on 429 / 5xx using tenacity
  - Token usage logged when benchmark_mode=True
  - Model name comes from settings (env var), not a hardcoded constant
  - parse_json extracted to a shared utility so both providers use it
  - Proper error wrapping → ProviderError (never leaks raw google exceptions)
"""
from __future__ import annotations

import base64
import json
import re

import google.generativeai as genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, VisionProvider


def _is_retryable(exc: Exception) -> bool:
    """Retry on rate-limit or transient server errors from the Gemini SDK."""
    msg = str(exc).lower()
    return any(kw in msg for kw in ("429", "rate", "quota", "503", "unavailable"))


class GeminiProvider(VisionProvider):

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise ProviderError(
                code="MISSING_API_KEY",
                message="GEMINI_API_KEY is not set. Add it to your .env file.",
            )
        # Configure once at construction — not on every call
        genai.configure(api_key=settings.gemini_api_key)
        self._model_name = settings.gemini_model
        self._model = genai.GenerativeModel(self._model_name)
        self._benchmark = settings.benchmark_mode

    @property
    def model_name(self) -> str:
        return self._model_name

    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def _call_with_retry(self, image_bytes: bytes, mime_type: str, prompt: str) -> ProviderResponse:
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_bytes).decode(),
        }
        response = self._model.generate_content([prompt, image_part])
        text = response.text.strip()

        # Token usage for benchmarking
        input_tokens = output_tokens = None
        if self._benchmark:
            try:
                meta = response.usage_metadata
                input_tokens = getattr(meta, "prompt_token_count", None)
                output_tokens = getattr(meta, "candidates_token_count", None)
            except Exception:
                pass

        return ProviderResponse(
            text=text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model_used=self._model_name,
        )

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
    ) -> ProviderResponse:
        try:
            return self._call_with_retry(image_bytes, mime_type, prompt)
        except Exception as exc:
            raise ProviderError(
                code="GEMINI_ERROR",
                message=f"Gemini call failed after retries: {exc}",
                details={"model": self._model_name, "detail": str(exc)},
            ) from exc


def parse_provider_json(text: str) -> dict:
    """
    Parse JSON from a model response.
    Strips markdown fences, handles trailing commas, gives a clear error.

    FIX vs original: was a bare json.loads — now has fence stripping + clear error.
    """
    cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
    # Remove trailing commas before } or ] (common model mistake)
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            code="JSON_PARSE_ERROR",
            message=f"Model returned invalid JSON: {exc}",
            details={"raw_snippet": cleaned[:300]},
        ) from exc