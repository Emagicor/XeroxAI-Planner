"""
main.py

FIX vs original:
  - CORS no longer uses allow_origins=["*"] — reads from settings
  - Structured logging configured at startup
  - All routes registered via a single register_routes function
  - Exception handlers registered centrally
"""
from __future__ import annotations

import sys
import os

# Add src/ to path so all imports resolve from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv

_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_ENV_PATH, override=True)

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import get_settings, reload_settings
from src.api.middleware.error_handler import register_exception_handlers
from src.api.routes import analyze, detect, export, health


log = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    # Fresh .env on every process start (clears @lru_cache on settings + vision provider).
    settings = reload_settings()

    # Structured logging
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if settings.app_env == "development"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            __import__("logging").INFO
        ),
        logger_factory=structlog.PrintLoggerFactory(),
    )

    app = FastAPI(
        title="ZeroxAI Floor Plan Analyzer",
        version="0.2.0",
        docs_url="/docs" if settings.app_env == "development" else None,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Routes ────────────────────────────────────────────────────────────────
    app.include_router(health.router, tags=["health"])
    app.include_router(detect.router, tags=["detect"])
    app.include_router(analyze.router, tags=["analyze"])
    app.include_router(export.router, tags=["export"])

    import hashlib

    gemini_fp = None
    if settings.vision_provider == "gemini" and settings.gemini_api_key:
        gemini_fp = hashlib.sha256(settings.gemini_api_key.encode()).hexdigest()[:12]

    log.info(
        "app.created",
        env=settings.app_env,
        provider=settings.vision_provider,
        gemini_model=settings.gemini_model if settings.vision_provider == "gemini" else None,
        gemini_key_configured=bool(settings.gemini_api_key),
        gemini_key_fingerprint=gemini_fp,
        env_file=_ENV_PATH,
    )

    if settings.vision_provider.lower() == "gemini":
        # Temporary debug — user-requested key visibility in terminal.
        print(f"[startup] GEMINI_API_KEY={settings.gemini_api_key!r}")
        print(f"[startup] GEMINI_MODEL={settings.gemini_model!r}")
        from providers.vision.gemini import probe_gemini_api

        probe = probe_gemini_api()
        if probe.get("ok"):
            print(f"[startup] Gemini API OK: {probe.get('response')!r}")
            log.info("gemini.probe_ok", model=probe.get("model"), response=probe.get("response"))
        else:
            print(f"[startup] Gemini API error ({probe.get('error_type')}): {probe.get('error')}")
            log.warning(
                "gemini.probe_failed",
                model=probe.get("model"),
                error_type=probe.get("error_type"),
                error=probe.get("error"),
            )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)