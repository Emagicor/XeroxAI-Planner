from io import BytesIO
from config.constants import PDF_RENDER_DPI

def convert_pdf_to_jpeg(pdf_bytes: bytes) -> tuple[bytes, str]:
    from pdf2image import convert_from_bytes

    pages = convert_from_bytes(
        pdf_bytes,
        dpi=PDF_RENDER_DPI,
        poppler_path=r"C:\Users\ASUS\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin"
    )

    buffer = BytesIO()
    pages[0].save(buffer, format="JPEG")
    return buffer.getvalue(), "image/jpeg"