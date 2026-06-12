"""Resolved feature flags for the current deployment environment."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from config.settings import Settings


def is_production_env(app_env: str) -> bool:
    return app_env.strip().lower() == "production"


def resolve_openapi_docs(settings: Settings) -> bool:
    if settings.feature_openapi is not None:
        return settings.feature_openapi
    return not is_production_env(settings.app_env)


def resolve_vision_prompt_log(settings: Settings) -> bool:
    if settings.feature_vision_prompt_log is not None:
        return settings.feature_vision_prompt_log
    if is_production_env(settings.app_env):
        return False
    return settings.vision_prompt_log_enabled


def feature_flags(settings: Settings) -> dict[str, bool]:
    return {
        "openapi_docs": resolve_openapi_docs(settings),
        "vision_prompt_log": resolve_vision_prompt_log(settings),
    }
