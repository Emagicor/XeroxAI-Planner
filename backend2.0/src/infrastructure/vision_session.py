"""Process-wide serialization of vision API calls — one analysis at a time."""
from __future__ import annotations

import threading

# Ensures back-to-back test-suite uploads cannot overlap vision calls in one worker.
VISION_API_LOCK = threading.Lock()
