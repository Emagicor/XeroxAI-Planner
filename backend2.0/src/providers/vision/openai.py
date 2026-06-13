"""GPT-4o vision provider — same pipeline contract as Gemini."""
from __future__ import annotations

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.openai_compatible import OpenAICompatibleVisionProvider


class OpenAIProvider(OpenAICompatibleVisionProvider):

    def _provider_key(self) -> str:
        return "openai"

    def _ensure_api_key(self, settings) -> None:
        if not settings.openai_api_key:
            raise ProviderError(
                code="MISSING_API_KEY",
                message="OPENAI_API_KEY is not set.",
            )

    def _build_client(self, settings):
        import openai

        return openai.OpenAI(
            api_key=settings.openai_api_key,
            timeout=self._timeout,
        )

    def _default_model(self, settings) -> str:
        return settings.openai_model
