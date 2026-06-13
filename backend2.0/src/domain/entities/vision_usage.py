"""Vision API usage metadata — real token counts from provider responses."""
from __future__ import annotations

from dataclasses import dataclass, field

from providers.vision.base import TokenUsage


def _token_dict(usage: TokenUsage | None) -> dict[str, int | None]:
    if usage is None:
        return {
            "prompt_token_count": None,
            "candidates_token_count": None,
            "thoughts_token_count": None,
            "total_token_count": None,
        }
    return {
        "prompt_token_count": usage.prompt_token_count,
        "candidates_token_count": usage.candidates_token_count,
        "thoughts_token_count": usage.thoughts_token_count,
        "total_token_count": usage.total_token_count,
    }


@dataclass
class VisionPassRecord:
    """One vision API call (extraction or correction pass)."""

    pass_number: int
    pass_kind: str  # "extraction" | "correction"
    provider: str
    model: str | None
    usage: TokenUsage
    page_number: int | None = None
    correction_mode: str | None = None  # "selective" | "full_fallback"
    correction_fields: dict | None = None

    def to_dict(self) -> dict:
        payload = {
            "pass": self.pass_number,
            "pass_kind": self.pass_kind,
            "provider": self.provider,
            "model": self.model,
            "page_number": self.page_number,
            **_token_dict(self.usage),
        }
        if self.correction_mode:
            payload["correction_mode"] = self.correction_mode
        if self.correction_fields is not None:
            payload["correction_fields"] = self.correction_fields
        return payload


@dataclass
class VisionUsageSnapshot:
    """Aggregated usage for one page/region (1–2 API calls)."""

    passes: list[VisionPassRecord] = field(default_factory=list)
    totals: TokenUsage = field(default_factory=TokenUsage)
    api_calls: int = 0
    page_number: int | None = None

    def merge(self, other: VisionUsageSnapshot | None) -> VisionUsageSnapshot:
        if other is None:
            return self
        return VisionUsageSnapshot(
            passes=[*self.passes, *other.passes],
            totals=self.totals.add(other.totals),
            api_calls=self.api_calls + other.api_calls,
            page_number=self.page_number or other.page_number,
        )

    def to_dict(self) -> dict:
        return {
            "page_number": self.page_number,
            "api_calls": self.api_calls,
            "passes": [p.to_dict() for p in self.passes],
            "totals": _token_dict(self.totals),
        }


@dataclass
class JobVisionUsage:
    """Job-level vision usage across all pages/regions."""

    pages: list[VisionUsageSnapshot] = field(default_factory=list)
    totals: TokenUsage = field(default_factory=TokenUsage)
    api_calls: int = 0

    @classmethod
    def from_page_snapshots(cls, snapshots: list[VisionUsageSnapshot | None]) -> JobVisionUsage | None:
        valid = [s for s in snapshots if s is not None and s.api_calls > 0]
        if not valid:
            return None

        totals = TokenUsage()
        api_calls = 0
        for snap in valid:
            totals = totals.add(snap.totals)
            api_calls += snap.api_calls

        return cls(pages=valid, totals=totals, api_calls=api_calls)

    @property
    def extraction_model(self) -> str | None:
        for page in self.pages:
            for record in page.passes:
                if record.pass_kind == "extraction" and record.model:
                    return record.model
        return None

    @property
    def correction_model(self) -> str | None:
        for page in self.pages:
            for record in page.passes:
                if record.pass_kind == "correction" and record.model:
                    return record.model
        return None

    @property
    def extraction_provider(self) -> str | None:
        for page in self.pages:
            for record in page.passes:
                if record.pass_kind == "extraction":
                    return record.provider
        return None

    @property
    def correction_provider(self) -> str | None:
        for page in self.pages:
            for record in page.passes:
                if record.pass_kind == "correction":
                    return record.provider
        return None

    def all_passes(self) -> list[VisionPassRecord]:
        out: list[VisionPassRecord] = []
        for page in self.pages:
            out.extend(page.passes)
        return out

    def to_dict(self) -> dict:
        passes = [p.to_dict() for p in self.all_passes()]
        models = {
            "extraction": {
                "provider": self.extraction_provider,
                "model": self.extraction_model,
            },
            "correction": {
                "provider": self.correction_provider,
                "model": self.correction_model,
            },
        }
        return {
            "api_calls": self.api_calls,
            "passes": passes,
            "pages": [p.to_dict() for p in self.pages],
            "totals": _token_dict(self.totals),
            "models": models,
        }
