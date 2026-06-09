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


def _build_provider() -> VisionProvider:
    """Construct a new provider instance (no shared request state)."""
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


@lru_cache(maxsize=1)
def get_vision_provider() -> VisionProvider:
    """
    Cached singleton for long-lived processes (e.g. health checks).
    Pipeline uses create_vision_provider() for per-request isolation.
    """
    return _build_provider()


def clear_vision_provider_cache() -> None:
    """Drop cached provider after .env / API key changes."""
    get_vision_provider.cache_clear()


def create_vision_provider() -> VisionProvider:
    """
    Fresh provider per analyze request — same isolation as uploading once in Analyze tab.
    Avoids any cross-request state when the test suite runs many cases back-to-back.
    """
    return _build_provider()


def create_correction_validator() -> VisionProvider:
    """
    Separate Gemini agent for the correction pass: same API key/model, different
    system instruction focused on validating pass-1 JSON against the image.
    """
    settings = get_settings()
    provider = settings.vision_provider.lower()

    if provider == "gemini":
        from providers.vision.gemini import VALIDATOR_SYSTEM_INSTRUCTION, GeminiProvider
        return GeminiProvider(system_instruction=VALIDATOR_SYSTEM_INSTRUCTION)

    if provider == "openai":
        from providers.vision.openai import OpenAIProvider
        return OpenAIProvider()

    raise ZeroxError(
        code="UNKNOWN_PROVIDER",
        message=f"Unknown vision provider '{provider}'. Set VISION_PROVIDER=gemini or openai.",
    )