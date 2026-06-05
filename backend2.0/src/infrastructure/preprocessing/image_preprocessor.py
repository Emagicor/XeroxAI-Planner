"""
Preprocess floor-plan images before sending to the vision model.

Optimized for architectural line drawings: upscale, autocontrast, sharpen.
"""
from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

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

    # Improve line contrast for thin architectural strokes
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Contrast(img).enhance(settings.contrast_factor)
    img = img.filter(ImageFilter.SHARPEN)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=2))

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=settings.jpeg_quality, optimize=True)
    return buffer.getvalue()
