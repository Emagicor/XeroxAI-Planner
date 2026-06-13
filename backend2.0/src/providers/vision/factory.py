"""
providers/vision/factory.py

Returns the configured VisionProvider based on VISION_PROVIDER env var.
All providers share the same extraction + correction pipeline.
"""
from __future__ import annotations

from config.settings import get_settings
from domain.exceptions import ZeroxError
from providers.vision.base import VisionProvider
from providers.vision.instructions import VALIDATOR_SYSTEM_INSTRUCTION
from providers.vision.request_config import VisionOverride


def resolve_extraction_provider(override: VisionOverride | None) -> str:
    """Public helper — provider used for pass-1 extraction."""
    return _resolve_provider_name(override)


def resolve_correction_provider_model(
    override: VisionOverride | None,
) -> tuple[str, str | None]:
    """Public helper — provider/model configured for pass-2 correction."""
    return _resolve_correction_provider_model(override)


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


def _build_provider(
    override: VisionOverride | None = None,
    *,
    provider: str | None = None,
    model: str | None = None,
    system_instruction: str | None = None,
) -> VisionProvider:
    """Construct a new provider instance (no shared request state)."""
    provider = provider or _resolve_provider_name(override)
    model = model if model is not None else _resolve_model_name(override, provider=provider)

    if provider == "gemini":
        from providers.vision.gemini import GeminiProvider
        return GeminiProvider(system_instruction=system_instruction, model=model)

    if provider == "openai":
        from providers.vision.openai import OpenAIProvider
        return OpenAIProvider(system_instruction=system_instruction, model=model)

    if provider == "groq":
        from providers.vision.groq import GroqProvider
        return GroqProvider(system_instruction=system_instruction, model=model)

    raise ZeroxError(
        code="UNKNOWN_PROVIDER",
        message=(
            f"Unknown vision provider '{provider}'. "
            "Set VISION_PROVIDER=gemini, openai, or groq."
        ),
    )


def clear_vision_provider_cache() -> None:
    """No-op — providers are created per request (kept for settings reload hook)."""
    return None


def create_vision_provider(override: VisionOverride | None = None) -> VisionProvider:
    """
    Fresh provider per analyze request — same isolation as uploading once in Analyze tab.
    Avoids any cross-request state when the test suite runs many cases back-to-back.
    """
    return _build_provider(override)


def create_correction_validator(override: VisionOverride | None = None) -> VisionProvider:
    """
    Provider for the correction pass (CORRECTION_PROMPT).

    Uses VALIDATOR_SYSTEM_INSTRUCTION on all providers (Gemini, OpenAI, Groq).
    Provider/model can differ from extraction via VISION_CORRECTION_* env vars.
    """
    provider, model = _resolve_correction_provider_model(override)
    return _build_provider(
        override,
        provider=provider,
        model=model,
        system_instruction=VALIDATOR_SYSTEM_INSTRUCTION,
    )
