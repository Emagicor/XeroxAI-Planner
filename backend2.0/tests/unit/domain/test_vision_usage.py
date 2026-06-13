"""Unit tests for vision usage aggregation."""

from providers.vision.base import TokenUsage
from domain.entities.vision_usage import (
    JobVisionUsage,
    VisionPassRecord,
    VisionUsageSnapshot,
)


def test_token_usage_add_sums_real_api_fields():
    a = TokenUsage(prompt_token_count=100, candidates_token_count=50, total_token_count=150)
    b = TokenUsage(prompt_token_count=200, candidates_token_count=80, total_token_count=280)
    merged = a.add(b)
    assert merged.prompt_token_count == 300
    assert merged.candidates_token_count == 130
    assert merged.total_token_count == 430


def test_vision_usage_snapshot_merge_accumulates_passes():
    snap1 = VisionUsageSnapshot(
        passes=[
            VisionPassRecord(
                pass_number=1,
                pass_kind="extraction",
                provider="groq",
                model="llama-scout",
                usage=TokenUsage(prompt_token_count=100, total_token_count=100),
                page_number=1,
            )
        ],
        totals=TokenUsage(prompt_token_count=100, total_token_count=100),
        api_calls=1,
        page_number=1,
    )
    snap2 = VisionUsageSnapshot(
        passes=[
            VisionPassRecord(
                pass_number=2,
                pass_kind="correction",
                provider="openai",
                model="gpt-4o",
                usage=TokenUsage(prompt_token_count=80, total_token_count=80),
                page_number=1,
                correction_mode="selective",
                correction_fields={"scan_for_missed_rooms": True},
            )
        ],
        totals=TokenUsage(prompt_token_count=80, total_token_count=80),
        api_calls=1,
        page_number=1,
    )
    merged = snap1.merge(snap2)
    assert merged.api_calls == 2
    assert len(merged.passes) == 2
    assert merged.totals.prompt_token_count == 180
    assert merged.totals.total_token_count == 180


def test_job_vision_usage_from_page_snapshots():
    page1 = VisionUsageSnapshot(
        passes=[
            VisionPassRecord(
                pass_number=1,
                pass_kind="extraction",
                provider="gemini",
                model="gemini-2.5-flash",
                usage=TokenUsage(prompt_token_count=500, total_token_count=500),
                page_number=1,
            ),
            VisionPassRecord(
                pass_number=2,
                pass_kind="correction",
                provider="openai",
                model="gpt-4o",
                usage=TokenUsage(prompt_token_count=300, total_token_count=300),
                page_number=1,
                correction_mode="selective",
                correction_fields={"rooms_to_verify": []},
            ),
        ],
        totals=TokenUsage(prompt_token_count=800, total_token_count=800),
        api_calls=2,
        page_number=1,
    )
    job_usage = JobVisionUsage.from_page_snapshots([page1])
    assert job_usage is not None
    assert job_usage.api_calls == 2
    assert job_usage.extraction_model == "gemini-2.5-flash"
    assert job_usage.correction_model == "gpt-4o"
    payload = job_usage.to_dict()
    assert payload["totals"]["total_token_count"] == 800
    assert len(payload["passes"]) == 2
    assert payload["passes"][1]["correction_fields"]["rooms_to_verify"] == []
