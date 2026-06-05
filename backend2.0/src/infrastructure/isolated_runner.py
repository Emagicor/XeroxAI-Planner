"""
Run each /analyze pipeline in a dedicated worker process.

Prevents any in-process state (SDK globals, model handles, memory) from leaking
between sequential test-suite uploads in the same API worker.
"""
from __future__ import annotations

import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from domain.entities.job import AnalyzeJob

_executor: ProcessPoolExecutor | None = None


def _get_executor() -> ProcessPoolExecutor:
    global _executor
    if _executor is None:
        ctx = mp.get_context("spawn")
        _executor = ProcessPoolExecutor(max_workers=1, mp_context=ctx)
    return _executor


def _pipeline_worker(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
) -> "AnalyzeJob":
    from application.orchestrators.analyze_orchestrator import run_analyze_pipeline

    return run_analyze_pipeline(filename, file_bytes, declared_mime)


def run_analyze_pipeline_isolated(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
    *,
    timeout_seconds: int = 900,
) -> "AnalyzeJob":
    """Run pipeline in a fresh process; blocks until complete."""
    payload = bytes(file_bytes)
    future = _get_executor().submit(
        _pipeline_worker,
        filename,
        payload,
        declared_mime,
    )
    return future.result(timeout=timeout_seconds)
