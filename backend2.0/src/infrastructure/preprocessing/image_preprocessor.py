"""
Preprocess floor-plan images before sending to the vision model.

PDF-derived rasters: CAD blue/cyan boost (same as UI) then lossless save — no
autocontrast crush. Uploaded photos still get light contrast enhancement.
"""
from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from config.settings import get_settings
from infrastructure.imaging.color_fidelity import (
    enhance_cad_markup_visibility,
    load_rgb,
    save_image,
)


def _boost_pdf_cad_colors(img: Image.Image) -> Image.Image:
    """Make pale CAD markup visible — used for vision input and UI for PDF pages."""
    return enhance_cad_markup_visibility(img)


def prepare_ui_preview_image(
    image_bytes: bytes,
    *,
    from_pdf: bool = False,
    max_preview_px: int = 2048,
) -> tuple[bytes, str]:
    """
    Web preview bytes: optional CAD blue boost (PDF only) + downscale for thumbnails.
    Does not modify the analysis image stored on the unit/region.
    """
    img = load_rgb(image_bytes)
    if from_pdf:
        img = _boost_pdf_cad_colors(img)

    width, height = img.size
    max_dim = max(width, height)
    if max_dim > max_preview_px:
        scale = max_preview_px / max_dim
        img = img.resize(
            (int(width * scale), int(height * scale)),
            Image.Resampling.LANCZOS,
        )
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))

    return save_image(img, fmt="png", jpeg_quality=98)


def prepare_display_image(
    image_bytes: bytes,
    *,
    from_pdf: bool = False,
) -> tuple[bytes, str]:
    """Bytes for UI display — same CAD color boost as vision input for PDFs."""
    settings = get_settings()
    img = load_rgb(image_bytes)
    if from_pdf:
        img = _boost_pdf_cad_colors(img)

    width, height = img.size
    max_dim = max(width, height)
    min_dim = settings.min_image_dimension

    if max_dim < min_dim:
        scale = min_dim / max_dim
        img = img.resize(
            (int(width * scale), int(height * scale)),
            Image.Resampling.LANCZOS,
        )

    fmt = settings.vision_image_format.lower().strip()
    return save_image(
        img,
        fmt=fmt,
        jpeg_quality=settings.jpeg_quality,
    )


def preprocess_image(
    image_bytes: bytes,
    *,
    preserve_colors: bool = False,
) -> tuple[bytes, str]:
    """
    Returns (image_bytes, mime_type) ready for the vision provider.
    """
    settings = get_settings()
    img = load_rgb(image_bytes)
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

    if preserve_colors:
        img = _boost_pdf_cad_colors(img)
        fmt = settings.vision_image_format.lower().strip()
        return save_image(img, fmt=fmt, jpeg_quality=settings.jpeg_quality)

    contrast = settings.contrast_factor_large if high_res else settings.contrast_factor

    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Contrast(img).enhance(contrast)

    if not high_res:
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=3))

    buffer = BytesIO()
    fmt = settings.vision_image_format.lower().strip()
    if fmt == "jpeg":
        img.save(
            buffer,
            format="JPEG",
            quality=settings.jpeg_quality,
            subsampling=0,
            optimize=True,
        )
        return buffer.getvalue(), "image/jpeg"

    img.save(buffer, format="PNG", compress_level=3)
    return buffer.getvalue(), "image/png"
