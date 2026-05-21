from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter

MIN_DIMENSION = 1500
CONTRAST_FACTOR = 1.4
JPEG_QUALITY = 95


def preprocess_image(image_bytes: bytes) -> bytes:
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = img.size
    max_dim = max(width, height)

    if max_dim < MIN_DIMENSION:
        scale = MIN_DIMENSION / max_dim
        img = img.resize(
            (int(width * scale), int(height * scale)),
            Image.Resampling.LANCZOS,
        )

    img = ImageEnhance.Contrast(img).enhance(CONTRAST_FACTOR)
    img = img.filter(ImageFilter.SHARPEN)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue()
