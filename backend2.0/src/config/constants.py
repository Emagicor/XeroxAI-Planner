"""
Compile-time constants — values that never change between deployments.
Tunable runtime values belong in settings.py instead.
"""

# ── Annotation palette (matches frontend ROOM_HEX_COLORS) ─────────────────────
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

# ── File validation ───────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

# ── Malware heuristics ────────────────────────────────────────────────────────
SUSPICIOUS_PDF_PATTERNS: list[bytes] = [
    b"/JavaScript",
    b"/JS ",
    b"/JS\n",
    b"/JS\r",
    b"/Launch",
    b"/OpenAction",
    b"/AA ",
    b"/EmbeddedFile",
    b"/RichMedia",
    b"/SubmitForm",
    b"/ImportData",
]

SUSPICIOUS_IMAGE_PATTERNS: list[bytes] = [
    b"<script",
    b"javascript:",
    b"PK\x03\x04",
]

# ── Confidence thresholds ─────────────────────────────────────────────────────
HIGH_CONFIDENCE_MIN = 85
MEDIUM_CONFIDENCE_MIN = 60

# ── Unit conversion from sq ft ────────────────────────────────────────────────
SQFT_TO: dict[str, float] = {
    "sqft":  1.0,
    "sqm":   0.092903,
    "sq-in": 144.0,
    "sq-cm": 929.03,
}

UNIT_LABELS: dict[str, str] = {
    "sqft":  "sq ft",
    "sqm":   "sq m",
    "sq-in": "sq in",
    "sq-cm": "sq cm",
}

# ── Physical constants ────────────────────────────────────────────────────────
METERS_TO_FEET = 3.28084
MM_TO_FEET = 1 / 304.8
CM_TO_FEET = 1 / 30.48

# ── Vision / analysis (legacy backend defaults) ───────────────────────────────
MAX_ANALYSIS_ATTEMPTS = 3
