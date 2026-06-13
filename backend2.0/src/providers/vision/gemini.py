"""
Gemini vision provider.

Each vision call uses a new GenerativeModel instance (no chat history reuse).
Quota/auth errors fail immediately. Each call uses a bounded request timeout.
"""
from __future__ import annotations

import base64

import google.generativeai as genai

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, VisionProvider
from providers.vision.errors import classify_gemini_error
from providers.vision.gemini_usage import parse_gemini_usage_metadata
from providers.vision.instructions import (
    EXTRACTOR_SYSTEM_INSTRUCTION,
    VALIDATOR_SYSTEM_INSTRUCTION,
)
from providers.vision.retry import call_with_transient_retry

__all__ = [
    "GeminiProvider",
    "EXTRACTOR_SYSTEM_INSTRUCTION",
    "VALIDATOR_SYSTEM_INSTRUCTION",
]

_VISION_MAX_OUTPUT_TOKENS = 4096


class GeminiProvider(VisionProvider):

    def __init__(self, *, system_instruction: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise ProviderError(
                code="MISSING_API_KEY",
                message="GEMINI_API_KEY is not set. Add it to your .env file.",
            )
        self._model_name = model or settings.gemini_model
        self._transient_retries = max(0, settings.gemini_transient_retries)
        self._request_timeout = max(30, settings.gemini_request_timeout_seconds)
        self._system_instruction = system_instruction or EXTRACTOR_SYSTEM_INSTRUCTION
        genai.configure(api_key=settings.gemini_api_key)

    @property
    def model_name(self) -> str:
        return self._model_name

    def _new_model(self) -> genai.GenerativeModel:
        """Fresh model per call — avoids implicit multi-turn state on reused handles."""
        return genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=self._system_instruction,
            generation_config=genai.GenerationConfig(
                temperature=0,
                top_p=1,
                # max_output_tokens=_VISION_MAX_OUTPUT_TOKENS,
                response_mime_type="application/json",
            ),
        )

    def _generate_once(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
    ) -> ProviderResponse:
        model = self._new_model()
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(bytes(image_bytes)).decode(),
        }
        response = model.generate_content(
            [prompt, image_part],
            request_options={"timeout": self._request_timeout},
        )
        text = (response.text or "").strip()
        usage = parse_gemini_usage_metadata(response.usage_metadata)
        return ProviderResponse(
            text=text,
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
            model_used=self._model_name,
            usage=usage,
        )

    def _raise_provider_error(self, exc: Exception) -> None:
        raw = str(exc).strip()
        code, message = classify_gemini_error(exc, model=self._model_name)
        raise ProviderError(
            code=code,
            message=message,
            details={"model": self._model_name, "detail": raw[:400]},
        ) from exc

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
    ) -> ProviderResponse:
        return call_with_transient_retry(
            lambda: self._generate_once(image_bytes, mime_type, prompt),
            transient_retries=self._transient_retries,
            on_error=self._raise_provider_error,
        )
