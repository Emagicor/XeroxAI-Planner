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
    pdf_render_dpi: int = 200          # higher DPI improves line clarity on multi-page PDFs

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

    # ── Analysis / vision API usage ───────────────────────────────────────────
    # Each page: 1 Gemini call by default; +1 only when pass-1 JSON needs correction.
    max_analysis_attempts: int = 1     # full re-runs only on validation failure
    vision_two_pass: bool = False      # true = always run extract + correction (2 calls/page)
    vision_correction_pass: bool = True  # when two_pass false: 2nd call only if pass-1 weak
    gemini_transient_retries: int = 0  # retries on 503 only; never retries quota (429)

    # ── Benchmarking ─────────────────────────────────────────────────────────
    benchmark_mode: bool = False       # logs token/image usage when True

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()