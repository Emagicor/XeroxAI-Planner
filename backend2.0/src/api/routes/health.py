"""Health check — used by load balancers and local dev."""
from __future__ import annotations

from fastapi import APIRouter

from config.settings import get_settings

router = APIRouter()


@router.get("/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "env": settings.app_env,
        "vision_provider": settings.vision_provider,
    }
