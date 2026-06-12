"""Per-request vision provider/model overrides (e.g. test-suite batch runs)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class VisionOverride:
    provider: str | None = None
    model: str | None = None
    correction_provider: str | None = None
    correction_model: str | None = None

    @property
    def is_set(self) -> bool:
        return bool(
            self.provider
            or self.model
            or self.correction_provider
            or self.correction_model
        )
