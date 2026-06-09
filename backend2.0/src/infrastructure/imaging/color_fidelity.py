"""
Color-faithful image loading and saving.

Avoids common quality traps:
- PIL Image.convert("RGB") composites transparency onto black (washes out PDF layers)
- JPEG 4:2:0 chroma subsampling bleeds fine colored lines
"""
from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image


def open_image(image_bytes: bytes) -> Image.Image:
    img = Image.open(BytesIO(image_bytes))
    img.load()
    return img


def composite_on_white(img: Image.Image) -> Image.Image:
    """Flatten alpha, palette, and CMYK modes onto a white background."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        return Image.alpha_composite(background, rgba).convert("RGB")

    if img.mode == "P":
        return img.convert("RGB")

    if img.mode == "CMYK":
        return img.convert("RGB")

    if img.mode != "RGB":
        return img.convert("RGB")

    return img


def load_rgb(image_bytes: bytes) -> Image.Image:
    return composite_on_white(open_image(image_bytes))


def enhance_cad_markup_visibility(img: Image.Image) -> Image.Image:
    """
    Boost pale CAD cyan/blue markup so it is visible on white.

    PyMuPDF raster fidelity is correct, but pale fills like (215, 235, 255) have
    ~1.1:1 contrast on white — too faint for humans and vision models. Only blue/cyan
    markup pixels are adjusted; walls and black linework are untouched.
    """
    rgb = img if img.mode == "RGB" else composite_on_white(img)
    arr = np.asarray(rgb).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    luminance = 0.299 * r + 0.587 * g + 0.114 * b

    blue_markup = (
        (b > r + 8)
        & (b > g + 2)
        & (luminance > 85)
        & (luminance < 250)
        & ~((r < 45) & (g < 45) & (b < 45))
    )
    if not np.any(blue_markup):
        return rgb

    out = arr.copy()
    pale = blue_markup & ((b - r) < 85)
    stroke = blue_markup & ~pale

    if np.any(stroke):
        out[..., 2][stroke] = np.clip(b[stroke] + 55, 0, 255)
        out[..., 1][stroke] = np.clip(g[stroke] * 0.82 + 18, 0, 255)
        out[..., 0][stroke] = np.clip(r[stroke] * 0.65, 0, 255)

    if np.any(pale):
        # Near-white CAD fills/arcs (e.g. 215,235,255) → visible cyan on screen
        out[..., 2][pale] = np.clip(95 + b[pale] * 0.32, 0, 255)
        out[..., 1][pale] = np.clip(55 + g[pale] * 0.28, 0, 255)
        out[..., 0][pale] = np.clip(25 + r[pale] * 0.18, 0, 255)

    return Image.fromarray(out.astype(np.uint8))


# Backward-compatible alias
enhance_cad_markup_for_display = enhance_cad_markup_visibility


def content_mask_from_rgb(
    arr: np.ndarray,
    *,
    threshold: int = 245,
    min_chroma: int = 14,
) -> np.ndarray:
    """
    True for non-background pixels: dark ink OR colored markup (e.g. pale blue fills).

    Brightness-only masks treat pale blue (204, 229, 255) as white and drop it during
    detection cropping — screenshots often look darker and survive; PDF rasters do not.
    """
    if arr.ndim != 3 or arr.shape[2] < 3:
        return np.zeros(arr.shape[:2], dtype=bool)

    bright_ink = (arr < threshold).any(axis=2)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    return bright_ink | (chroma >= min_chroma)


def save_image(
    img: Image.Image,
    *,
    fmt: str = "png",
    jpeg_quality: int = 98,
) -> tuple[bytes, str]:
    buffer = BytesIO()
    normalized = fmt.lower().strip()

    if normalized == "jpeg":
        rgb = img if img.mode == "RGB" else composite_on_white(img)
        rgb.save(
            buffer,
            format="JPEG",
            quality=jpeg_quality,
            subsampling=0,
            optimize=True,
        )
        return buffer.getvalue(), "image/jpeg"

    rgb = img if img.mode == "RGB" else composite_on_white(img)
    rgb.save(buffer, format="PNG", compress_level=3)
    return buffer.getvalue(), "image/png"
