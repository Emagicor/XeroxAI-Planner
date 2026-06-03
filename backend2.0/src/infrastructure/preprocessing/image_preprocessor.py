"""
Preprocess floor-plan images before sending to the vision model.

Uses the same pipeline as the legacy backend (upscale, contrast, sharpen)
which benchmarks better than deskew/denoise for architectural drawings.
"""
from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter

from config.settings import get_settings


def preprocess_image(image_bytes: bytes) -> bytes:
    settings = get_settings()
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = img.size
    max_dim = max(width, height)
    min_dim = settings.min_image_dimension

    if max_dim < min_dim:
        scale = min_dim / max_dim
        img = img.resize(
            (int(width * scale), int(height * scale)),
            Image.Resampling.LANCZOS,
        )

    img = ImageEnhance.Contrast(img).enhance(settings.contrast_factor)
    img = img.filter(ImageFilter.SHARPEN)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=settings.jpeg_quality)
    return buffer.getvalue()
