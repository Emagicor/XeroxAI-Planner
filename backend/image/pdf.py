from io import BytesIO
from config.constants import PDF_RENDER_DPI


def convert_pdf_to_jpegs(pdf_bytes: bytes) -> list[tuple[bytes, str]]:
    """
    Convert every page of a PDF to JPEG bytes.
    Returns a list of (image_bytes, mime_type) tuples — one per page.
    """
    from pdf2image import convert_from_bytes

    pages = convert_from_bytes(
        pdf_bytes,
        dpi=PDF_RENDER_DPI,
        poppler_path=r"C:\Users\ASUS\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin",
    )

    result: list[tuple[bytes, str]] = []
    for page in pages:
        buffer = BytesIO()
        page.save(buffer, format="JPEG")
        result.append((buffer.getvalue(), "image/jpeg"))

    return result


# ── backward-compat shim (used by old routes that expect a single page) ──────
def convert_pdf_to_jpeg(pdf_bytes: bytes) -> tuple[bytes, str]:
    pages = convert_pdf_to_jpegs(pdf_bytes)
    if not pages:
        raise ValueError("PDF produced no pages")
    return pages[0]