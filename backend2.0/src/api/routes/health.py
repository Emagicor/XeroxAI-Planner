"""Health check — used by load balancers and local dev."""
from __future__ import annotations

import hashlib

from fastapi import APIRouter

from config.settings import _ENV_FILE, get_settings

router = APIRouter()


@router.get("/health")
def health():
    settings = get_settings()
    gemini: dict | None = None
    if settings.vision_provider.lower() == "gemini":
        key = settings.gemini_api_key
        gemini = {
            "configured": bool(key),
            "model": settings.gemini_model,
            "key_fingerprint": hashlib.sha256(key.encode()).hexdigest()[:12] if key else None,
            "env_file": str(_ENV_FILE),
        }
    return {
        "status": "ok",
        "env": settings.app_env,
        "vision_provider": settings.vision_provider,
        "gemini": gemini,
    }
