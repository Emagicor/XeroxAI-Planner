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
    pdf_render_dpi: int = 300          # higher DPI improves line clarity on multi-page PDFs
    pdf_raster_format: str = "png"     # png = lossless; jpeg uses pdf_render_jpeg_quality
    pdf_render_jpeg_quality: int = 98

    # ── Preprocessing ─────────────────────────────────────────────────────────
    min_image_dimension: int = 1800    # upscale if smaller (helps dimension text on PDFs)
    contrast_factor: float = 1.35
    contrast_factor_large: float = 1.12  # gentler when image already high-res
    jpeg_quality: int = 98
    vision_image_format: str = "png"   # png | jpeg — format sent to Gemini

    # ── Vision provider ───────────────────────────────────────────────────────
    vision_provider: str = "gemini"    # gemini | openai
    gemini_model: str = "gemini-3.5-flash"
    openai_model: str = "gpt-4o"
    gemini_api_key: str = ""
    openai_api_key: str = ""

    # ── Analysis / vision API usage ───────────────────────────────────────────
    # Each page: 1 Gemini call by default; +1 only when pass-1 JSON needs correction.
    max_analysis_attempts: int = 2     # full re-runs on validation failure
    vision_two_pass: bool = False      # true = always run extract + correction (2 calls/page)
    vision_correction_pass: bool = True  # when two_pass false: 2nd call only if pass-1 weak
    gemini_transient_retries: int = 0  # retries on 503 only; never retries quota (429)

    # ── Grounding DINO detection ──────────────────────────────────────────────
    # backend: local = IDEA-Research repo on disk; huggingface = transformers hub
    grounding_dino_backend: str = "local"
    grounding_dino_enabled: bool = True
    # Local repo (empty → backend2.0/groundingdino_local)
    grounding_dino_repo_path: str = ""
    grounding_dino_config_path: str = ""
    grounding_dino_weights_path: str = ""
    grounding_dino_model: str = "IDEA-Research/grounding-dino-tiny"
    grounding_dino_prompt: str = (
        "individual floor plan . building floor plan . architectural floor plan ."
    )
    grounding_dino_threshold: float = 0.30
    grounding_dino_threshold_fallback: float = 0.22
    grounding_dino_text_threshold: float = 0.25
    grounding_dino_nms_iou: float = 0.42
    grounding_dino_device: str = "cuda"  # cpu | cuda
    # Crop padding + refinement (reduce over-tight clips)
    detection_bbox_padding: float = 0.07
    detection_bbox_padding_px: int = 28
    detection_clip_padding_ratio: float = 0.035
    detection_clip_padding_px: int = 20
    detection_min_area_ratio: float = 0.04
    detection_min_plan_area_ratio: float = 0.08
    detection_wide_aspect_ratio: float = 1.55
    detection_merge_iou: float = 0.12
    detection_merge_gap_ratio: float = 0.035
    detection_duplicate_iou: float = 0.55
    detection_dominant_plan_ratio: float = 0.50
    detection_fragment_max_ratio: float = 0.22
    detection_full_page_snap_ratio: float = 0.82

    # ── Benchmarking ─────────────────────────────────────────────────────────
    benchmark_mode: bool = False       # logs token/image usage when True

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()