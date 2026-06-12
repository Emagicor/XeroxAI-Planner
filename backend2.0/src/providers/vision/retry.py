"""Shared vision API call helpers — fail-fast errors, no quota retry storms."""
from __future__ import annotations

import time
from typing import Callable, TypeVar

from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse
from providers.vision.errors import is_fail_fast_error, is_transient_error, parse_retry_after_seconds

T = TypeVar("T")


def call_with_transient_retry(
    fn: Callable[[], ProviderResponse],
    *,
    transient_retries: int,
    on_error: Callable[[Exception], None],
) -> ProviderResponse:
    """
    Run one vision API call. Fail immediately on quota/auth/billing/model errors.
    Optionally retry transient 503-style failures (never quota 429).
    """
    attempts = 1 + max(0, transient_retries)
    last_exc: Exception | None = None

    for attempt in range(attempts):
        try:
            return fn()
        except ProviderError:
            raise
        except Exception as exc:
            last_exc = exc
            if is_fail_fast_error(exc):
                on_error(exc)
            if attempt < attempts - 1 and is_transient_error(exc):
                delay = parse_retry_after_seconds(exc) or 5.0
                time.sleep(delay)
                continue
            on_error(exc)

    assert last_exc is not None
    on_error(last_exc)
    raise AssertionError("unreachable")
