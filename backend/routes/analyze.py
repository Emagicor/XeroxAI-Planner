from flask import Blueprint, jsonify, request

from image.pdf import convert_pdf_to_jpeg
from services.analysis import validate_and_retry

analyze_bp = Blueprint("analyze", __name__)


def _is_pdf(file) -> bool:
    mime_type = file.content_type or ""
    filename = (file.filename or "").lower()
    return mime_type == "application/pdf" or filename.endswith(".pdf")


@analyze_bp.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    image_bytes = file.read()
    mime_type = file.content_type or "image/jpeg"

    if _is_pdf(file):
        try:
            image_bytes, mime_type = convert_pdf_to_jpeg(image_bytes)
        except Exception as exc:
            return jsonify({"error": f"PDF conversion failed: {exc}"}), 500

    try:
        result = validate_and_retry(image_bytes, mime_type)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
