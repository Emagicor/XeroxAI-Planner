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
load_dotenv()

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import get_settings
from src.api.middleware.error_handler import register_exception_handlers
from src.api.routes import analyze, export, health


log = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

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
    app.include_router(analyze.router, tags=["analyze"])
    app.include_router(export.router, tags=["export"])

    log.info(
        "app.created",
        env=settings.app_env,
        provider=settings.vision_provider,
        gemini_model=settings.gemini_model if settings.vision_provider == "gemini" else None,
    )
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)