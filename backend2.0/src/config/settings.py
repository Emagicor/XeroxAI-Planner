from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load backend2.0/.env regardless of process cwd
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    log_level: str = "INFO"
    temp_dir: str = "/tmp/zerox"
    cors_origins: list[str] = ["*"]

    # ── Feature flags (optional overrides; APP_ENV sets sensible defaults) ───
    feature_openapi: bool | None = None          # FEATURE_OPENAPI
    feature_vision_prompt_log: bool | None = None  # FEATURE_VISION_PROMPT_LOG

    # ── Upload limits ─────────────────────────────────────────────────────────
    max_upload_mb: int = 50
    max_pdf_pages: int = 100

    # ── PDF rendering ─────────────────────────────────────────────────────────
    pdf_render_dpi: int = 300          # CAD PDFs: keep >= 216 (3x); 300 recommended
    pdf_raster_format: str = "png"     # png = lossless (recommended for color fidelity)
    pdf_render_jpeg_quality: int = 98  # only when pdf_raster_format=jpeg

    # ── Preprocessing ─────────────────────────────────────────────────────────
    min_image_dimension: int = 1800    # upscale if smaller (helps dimension text on PDFs)
    contrast_factor: float = 1.35
    contrast_factor_large: float = 1.12  # gentler when image already high-res
    jpeg_quality: int = 98
    vision_image_format: str = "png"   # png | jpeg — format sent to Gemini

    # ── Vision provider ───────────────────────────────────────────────────────
    vision_provider: str = "gemini"    # gemini | openai | groq
    gemini_model: str = "gemini-3.5-flash"
    openai_model: str = "gpt-4o"
    groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    # Correction pass (FLOOR_PLAN_PROMPT → CORRECTION_PROMPT); empty = same as extraction
    vision_correction_provider: str = ""   # gemini | openai | groq
    vision_correction_model: str = ""      # e.g. gemini-2.5-flash, gpt-4o
    gemini_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""

    # ── Analysis / vision API usage ───────────────────────────────────────────
    # Pass 1: full extract. Pass 2 (selective): only low-confidence fields from pass 1.
    max_analysis_attempts: int = 1     # full re-runs on validation failure
    vision_two_pass: bool = False      # true = allow selective correction when targets exist
    vision_correction_pass: bool = True  # run pass 2 when pass-1 has low-confidence targets
    vision_correction_confidence_max: int = 84  # rooms at/below this (and derived/assumed) → pass 2
    gemini_transient_retries: int = 0  # retries on 503 for all vision providers
    gemini_request_timeout_seconds: int = 120  # per vision API call (all providers)
    vision_prompt_log_enabled: bool = True
    vision_prompt_log_dir: str = ""  # empty → backend2.0/_vision_prompt_logs

    # ── Region clipping ─────────────────────────────────────────────────────
    detection_clip_padding_ratio: float = 0.035
    detection_clip_padding_px: int = 20

    # ── Benchmarking ─────────────────────────────────────────────────────────
    benchmark_mode: bool = False       # logs token/image usage when True

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    """Clear cached settings after .env changes (still requires new provider instances)."""
    get_settings.cache_clear()
    try:
        from providers.vision.factory import clear_vision_provider_cache
        clear_vision_provider_cache()
    except ImportError:
        pass
    return get_settings()