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
        _executor = ProcessPoolExecutor(max_workers=3, mp_context=ctx)
    return _executor


def _pipeline_worker(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
    vision_provider: str | None,
    vision_model: str | None,
    vision_correction_provider: str | None,
    vision_correction_model: str | None,
) -> "AnalyzeJob":
    from application.orchestrators.analyze_orchestrator import run_analyze_pipeline
    from providers.vision.request_config import VisionOverride

    override = VisionOverride(
        provider=vision_provider,
        model=vision_model,
        correction_provider=vision_correction_provider,
        correction_model=vision_correction_model,
    )
    return run_analyze_pipeline(
        filename,
        file_bytes,
        declared_mime,
        vision_override=override if override.is_set else None,
    )


def run_analyze_pipeline_isolated(
    filename: str,
    file_bytes: bytes,
    declared_mime: str | None,
    *,
    vision_provider: str | None = None,
    vision_model: str | None = None,
    vision_correction_provider: str | None = None,
    vision_correction_model: str | None = None,
    timeout_seconds: int = 900,
) -> "AnalyzeJob":
    """Run pipeline in a fresh process; blocks until complete."""
    payload = bytes(file_bytes)
    future = _get_executor().submit(
        _pipeline_worker,
        filename,
        payload,
        declared_mime,
        vision_provider,
        vision_model,
        vision_correction_provider,
        vision_correction_model,
    )
    return future.result(timeout=timeout_seconds)
