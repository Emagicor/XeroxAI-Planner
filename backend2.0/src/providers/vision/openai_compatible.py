"""
Shared OpenAI Chat Completions vision path used by OpenAI and Groq.

Keeps temperature, JSON mode, timeouts, retries, and system instructions
aligned with the Gemini provider pipeline.
"""
from __future__ import annotations

import base64
from abc import ABC, abstractmethod

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, TokenUsage, VisionProvider
from providers.vision.instructions import EXTRACTOR_SYSTEM_INSTRUCTION
from providers.vision.retry import call_with_transient_retry

_VISION_MAX_TOKENS = 4096


def _json_mode_unsupported(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "response_format" in msg or "json_object" in msg


class OpenAICompatibleVisionProvider(VisionProvider, ABC):
    def __init__(
        self,
        *,
        model: str | None = None,
        system_instruction: str | None = None,
    ) -> None:
        settings = get_settings()
        self._ensure_api_key(settings)
        self._timeout = max(30, settings.gemini_request_timeout_seconds)
        self._transient_retries = max(0, settings.gemini_transient_retries)
        self._client = self._build_client(settings)
        self._model_name = model or self._default_model(settings)
        self._system_instruction = system_instruction or EXTRACTOR_SYSTEM_INSTRUCTION

    @property
    def model_name(self) -> str:
        return self._model_name

    @abstractmethod
    def _provider_key(self) -> str:
        """Short provider id for error classification (openai | groq)."""

    @abstractmethod
    def _ensure_api_key(self, settings) -> None:
        ...

    @abstractmethod
    def _build_client(self, settings):
        ...

    @abstractmethod
    def _default_model(self, settings) -> str:
        ...

    def _call_once(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
    ) -> ProviderResponse:
        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:{mime_type};base64,{b64}"

        messages = [
            {"role": "system", "content": self._system_instruction},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url, "detail": "high"},
                    },
                ],
            },
        ]

        kwargs = {
            "model": self._model_name,
            "messages": messages,
            "max_tokens": _VISION_MAX_TOKENS,
            "temperature": 0,
        }

        try:
            response = self._client.chat.completions.create(
                **kwargs,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            if _json_mode_unsupported(exc):
                response = self._client.chat.completions.create(**kwargs)
            else:
                raise

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
        from providers.vision.errors import classify_openai_compatible_error

        code, message = classify_openai_compatible_error(
            exc,
            provider=self._provider_key(),
            model=self._model_name,
        )
        raise ProviderError(
            code=code,
            message=message,
            details={"model": self._model_name, "detail": str(exc)[:400]},
        ) from exc

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
    ) -> ProviderResponse:
        return call_with_transient_retry(
            lambda: self._call_once(image_bytes, mime_type, prompt),
            transient_retries=self._transient_retries,
            on_error=self._raise_provider_error,
        )
