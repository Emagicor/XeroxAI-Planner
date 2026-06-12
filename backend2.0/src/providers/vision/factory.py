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
from providers.vision.request_config import VisionOverride


def _resolve_provider_name(override: VisionOverride | None) -> str:
    settings = get_settings()
    if override and override.provider:
        return override.provider.lower()
    return settings.vision_provider.lower()


def _resolve_model_name(override: VisionOverride | None, *, provider: str) -> str | None:
    if override and override.model:
        return override.model
    return None


def _resolve_correction_provider_model(
    extraction_override: VisionOverride | None,
) -> tuple[str, str | None]:
    """
    Provider/model for the correction pass (CORRECTION_PROMPT).

    Falls back to extraction provider/model when correction settings are unset.
    """
    settings = get_settings()
    extraction_provider = _resolve_provider_name(extraction_override)

    if extraction_override and extraction_override.correction_provider:
        provider = extraction_override.correction_provider.lower()
    elif settings.vision_correction_provider:
        provider = settings.vision_correction_provider.lower()
    else:
        provider = extraction_provider

    if extraction_override and extraction_override.correction_model:
        model = extraction_override.correction_model
    elif settings.vision_correction_model:
        model = settings.vision_correction_model
    elif (
        extraction_override
        and extraction_override.model
        and provider == extraction_provider
    ):
        model = extraction_override.model
    else:
        model = None

    return provider, model


_QWEN25_VL_ALIASES = frozenset({"qwen25_vl", "qwen2.5-vl", "qwen-vl", "qwen25-vl"})


def _is_qwen25_vl_provider(provider: str) -> bool:
    return provider.lower() in _QWEN25_VL_ALIASES


def _build_provider(
    override: VisionOverride | None = None,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> VisionProvider:
    """Construct a new provider instance (no shared request state)."""
    provider = provider or _resolve_provider_name(override)
    model = model if model is not None else _resolve_model_name(override, provider=provider)

    if provider == "gemini":
        from providers.vision.gemini import GeminiProvider
        return GeminiProvider(model=model)

    if provider == "openai":
        from providers.vision.openai import OpenAIProvider
        return OpenAIProvider(model=model)

    if provider == "groq":
        from providers.vision.groq import GroqProvider
        return GroqProvider(model=model)

    if provider in ("florence2", "florence-2"):
        from providers.vision.florence2 import Florence2Provider
        return Florence2Provider(model=model)

    if _is_qwen25_vl_provider(provider):
        from providers.vision.qwen25_vl import Qwen25VLProvider
        return Qwen25VLProvider(model=model)

    raise ZeroxError(
        code="UNKNOWN_PROVIDER",
        message=(
            f"Unknown vision provider '{provider}'. "
            "Set VISION_PROVIDER=gemini, openai, groq, florence2, or qwen25_vl."
        ),
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


def create_vision_provider(override: VisionOverride | None = None) -> VisionProvider:
    """
    Fresh provider per analyze request — same isolation as uploading once in Analyze tab.
    Avoids any cross-request state when the test suite runs many cases back-to-back.
    """
    return _build_provider(override)


def create_correction_validator(override: VisionOverride | None = None) -> VisionProvider:
    """
    Provider for the correction pass (CORRECTION_PROMPT).

    Provider/model can differ from extraction via VISION_CORRECTION_* env vars.
    Gemini uses a dedicated validator system instruction; OpenAI/Groq use the
    correction prompt in the user message (same chat API path as extraction).
    """
    provider, model = _resolve_correction_provider_model(override)

    if provider == "gemini":
        from providers.vision.gemini import VALIDATOR_SYSTEM_INSTRUCTION, GeminiProvider
        return GeminiProvider(system_instruction=VALIDATOR_SYSTEM_INSTRUCTION, model=model)

    if provider == "openai":
        from providers.vision.openai import OpenAIProvider
        return OpenAIProvider(model=model)

    if provider == "groq":
        from providers.vision.groq import GroqProvider
        return GroqProvider(model=model)

    if provider in ("florence2", "florence-2"):
        from providers.vision.florence2 import Florence2Provider
        return Florence2Provider(model=model)

    if _is_qwen25_vl_provider(provider):
        from providers.vision.qwen25_vl import Qwen25VLProvider
        return Qwen25VLProvider(model=model)

    raise ZeroxError(
        code="UNKNOWN_PROVIDER",
        message=(
            f"Unknown vision correction provider '{provider}'. "
            "Set VISION_CORRECTION_PROVIDER=gemini, openai, groq, florence2, or qwen25_vl."
        ),
    )
