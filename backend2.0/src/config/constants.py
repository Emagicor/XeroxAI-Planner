"""
Compile-time constants — values that never change between deployments.
Tunable runtime values belong in settings.py instead.
"""

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
