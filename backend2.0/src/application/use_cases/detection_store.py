"""In-memory detection result store (Phase 1 — same lifetime as job store)."""
from __future__ import annotations

from threading import Lock

from domain.entities.detection import DocumentDetection

_store: dict[str, DocumentDetection] = {}
_lock = Lock()


def save_detection(detection: DocumentDetection) -> None:
    with _lock:
        _store[detection.detection_id] = detection


def get_detection(detection_id: str) -> DocumentDetection | None:
    with _lock:
        return _store.get(detection_id)
