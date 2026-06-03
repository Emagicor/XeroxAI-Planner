"""
providers/vision/factory.py

Returns the configured VisionProvider based on VISION_PROVIDER env var.
Add new providers here — zero changes needed in pipeline code.
"""
from __future__ import annotations

from functools import lru_cache

from config.settings import get_settings
from domain.exceptions import ZeroxError
from providers.vision.base import VisionProvider


@lru_cache(maxsize=1)
def get_vision_provider() -> VisionProvider:
    """
    Singleton factory — provider is constructed once and reused.
    Swap providers by changing VISION_PROVIDER in .env.
    """
    settings = get_settings()
    provider = settings.vision_provider.lower()

    if provider == "gemini":
        from providers.vision.gemini import GeminiProvider
        return GeminiProvider()

    if provider == "openai":
        from providers.vision.openai import OpenAIProvider
        return OpenAIProvider()

    raise ZeroxError(
        code="UNKNOWN_PROVIDER",
        message=f"Unknown vision provider '{provider}'. Set VISION_PROVIDER=gemini or openai.",
    )