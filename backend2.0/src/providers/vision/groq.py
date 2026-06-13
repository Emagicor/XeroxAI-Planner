"""Groq vision provider (OpenAI-compatible API) — same pipeline contract as Gemini."""
from __future__ import annotations

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.openai_compatible import OpenAICompatibleVisionProvider

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqProvider(OpenAICompatibleVisionProvider):

    def _provider_key(self) -> str:
        return "groq"

    def _ensure_api_key(self, settings) -> None:
        if not settings.groq_api_key:
            raise ProviderError(
                code="MISSING_API_KEY",
                message="GROQ_API_KEY is not set.",
            )

    def _build_client(self, settings):
        import openai

        return openai.OpenAI(
            api_key=settings.groq_api_key,
            base_url=GROQ_BASE_URL,
            timeout=self._timeout,
        )

    def _default_model(self, settings) -> str:
        return settings.groq_model
