ROOM_COLORS = [
    (29, 158, 117),
    (127, 119, 221),
    (186, 117, 23),
    (216, 90, 48),
    (55, 138, 221),
    (99, 153, 34),
    (212, 83, 126),
    (136, 135, 128),
]

ROOM_HEX_COLORS = [
    "#1D9E75",
    "#7F77DD",
    "#BA7517",
    "#D85A30",
    "#378ADD",
    "#639922",
    "#D4537E",
    "#888780",
]

GEMINI_MODEL = "gemini-2.5-flash"
MAX_ANALYSIS_ATTEMPTS = 3
PDF_RENDER_DPI = 150

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_UPLOAD_SIZE = 15 * 1024 * 1024
MAX_PDF_PAGE_COUNT = 10
