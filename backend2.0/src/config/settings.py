from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    log_level: str = "INFO"
    temp_dir: str = "/tmp/zerox"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── Upload limits ─────────────────────────────────────────────────────────
    max_upload_mb: int = 50
    max_pdf_pages: int = 100

    # ── PDF rendering ─────────────────────────────────────────────────────────
    pdf_render_dpi: int = 150          # match legacy backend (poppler default)

    # ── Preprocessing ─────────────────────────────────────────────────────────
    min_image_dimension: int = 1500    # upscale if smaller
    contrast_factor: float = 1.4
    jpeg_quality: int = 95

    # ── Vision provider ───────────────────────────────────────────────────────
    vision_provider: str = "gemini"    # gemini | openai
    gemini_model: str = "gemini-2.5-flash"
    openai_model: str = "gpt-4o"
    gemini_api_key: str = ""
    openai_api_key: str = ""

    # ── Analysis ─────────────────────────────────────────────────────────────
    max_analysis_attempts: int = 3     # matches legacy backend retry budget

    # ── Benchmarking ─────────────────────────────────────────────────────────
    benchmark_mode: bool = False       # logs token/image usage when True

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()