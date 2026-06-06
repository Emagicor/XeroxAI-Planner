"""Tests for local Grounding DINO path resolution."""
from __future__ import annotations

from pathlib import Path

from engines.detection.local_grounding_dino import (
    _BUNDLED_REPO,
    resolve_grounding_dino_paths,
)


def test_resolve_defaults_to_bundled_repo(monkeypatch):
    monkeypatch.delenv("GROUNDING_DINO_REPO_PATH", raising=False)
    from config.settings import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("GROUNDING_DINO_REPO_PATH", "")
    get_settings.cache_clear()

    repo, config, weights = resolve_grounding_dino_paths()
    assert repo == _BUNDLED_REPO
    assert config.name == "GroundingDINO_SwinT_OGC.py"
    assert weights.name == "groundingdino_swint_ogc.pth"


def test_resolve_custom_repo(monkeypatch, tmp_path: Path):
    custom = tmp_path / "gdino"
    custom.mkdir()
    (custom / "groundingdino" / "config").mkdir(parents=True)
    (custom / "weights").mkdir(parents=True)

    from config.settings import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("GROUNDING_DINO_REPO_PATH", str(custom))
    get_settings.cache_clear()

    repo, _, _ = resolve_grounding_dino_paths()
    assert repo == custom.resolve()
    get_settings.cache_clear()
