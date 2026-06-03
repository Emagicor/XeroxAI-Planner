"""
application/use_cases/job_store.py

Phase 1: in-memory job store. Jobs live only for the duration of the process.
Phase 2: swap this for a MongoDB repository without touching any other file.
"""
from __future__ import annotations

from threading import Lock

from domain.entities.job import AnalyzeJob

_store: dict[str, AnalyzeJob] = {}
_lock = Lock()


def save_job(job: AnalyzeJob) -> None:
    with _lock:
        _store[job.job_id] = job


def get_job(job_id: str) -> AnalyzeJob | None:
    with _lock:
        return _store.get(job_id)


def delete_job(job_id: str) -> None:
    with _lock:
        _store.pop(job_id, None)