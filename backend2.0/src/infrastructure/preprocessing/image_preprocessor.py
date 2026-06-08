"""
Preprocess floor-plan images before sending to the vision model.

Optimized for architectural line drawings: upscale, autocontrast, sharpen.
Uses lossless PNG by default to avoid compounding JPEG artifacts from PDF rasterization.
"""
from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from config.settings import get_settings


def preprocess_image(image_bytes: bytes) -> tuple[bytes, str]:
    """
    Returns (image_bytes, mime_type) ready for the vision provider.
    """
    settings = get_settings()
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = img.size
    max_dim = max(width, height)
    min_dim = settings.min_image_dimension
    high_res = max_dim >= min_dim

    if max_dim < min_dim:
        scale = min_dim / max_dim
        img = img.resize(
            (int(width * scale), int(height * scale)),
            Image.Resampling.LANCZOS,
        )

    contrast = settings.contrast_factor_large if high_res else settings.contrast_factor

    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Contrast(img).enhance(contrast)

    if not high_res:
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=3))

    buffer = BytesIO()
    fmt = settings.vision_image_format.lower().strip()
    if fmt == "jpeg":
        img.save(buffer, format="JPEG", quality=settings.jpeg_quality, optimize=True)
        return buffer.getvalue(), "image/jpeg"

    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue(), "image/png"
