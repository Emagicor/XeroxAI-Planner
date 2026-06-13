"""Health check — used by load balancers and local dev."""
from __future__ import annotations

import hashlib

from fastapi import APIRouter

from config.features import feature_flags
from config.settings import _ENV_FILE, get_settings

router = APIRouter()


def _key_fingerprint(key: str) -> str | None:
    if not key:
        return None
    return hashlib.sha256(key.encode()).hexdigest()[:12]


def _provider_health(settings) -> dict:
    provider = settings.vision_provider.lower()
    if provider == "gemini":
        return {
            "configured": bool(settings.gemini_api_key),
            "model": settings.gemini_model,
            "key_fingerprint": _key_fingerprint(settings.gemini_api_key),
        }
    if provider == "openai":
        return {
            "configured": bool(settings.openai_api_key),
            "model": settings.openai_model,
            "key_fingerprint": _key_fingerprint(settings.openai_api_key),
        }
    if provider == "groq":
        return {
            "configured": bool(settings.groq_api_key),
            "model": settings.groq_model,
            "key_fingerprint": _key_fingerprint(settings.groq_api_key),
        }
    return {"configured": False, "model": None, "key_fingerprint": None}


@router.get("/health")
def health():
    settings = get_settings()
    vision = _provider_health(settings)
    payload = {
        "status": "ok",
        "env": settings.app_env,
        "vision_provider": settings.vision_provider,
        "vision": vision,
        "features": feature_flags(settings),
        "env_file": str(_ENV_FILE),
    }
    if settings.vision_provider.lower() == "gemini":
        payload["gemini"] = vision
    return payload
