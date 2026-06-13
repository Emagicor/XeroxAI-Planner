"""
Write raw vision model outputs (floor-plan pass vs correction pass) to disk for diffing.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import structlog

from config.features import resolve_vision_prompt_log
from config.settings import get_settings
from providers.vision.json_parse import parse_provider_json

log = structlog.get_logger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_LOG_DIR = _BACKEND_ROOT / "_vision_prompt_logs"


def _resolve_log_dir() -> Path:
    settings = get_settings()
    raw = (settings.vision_prompt_log_dir or "").strip()
    return Path(raw).expanduser().resolve() if raw else _DEFAULT_LOG_DIR


def _safe_session_slug(session_id: str) -> str:
    slug = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in session_id)
    return slug[:48] or "session"


def _write_output(path: Path, *, header: str, raw_text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{header}\n\n{raw_text}", encoding="utf-8")


def _write_parsed_json(path: Path, raw_text: str) -> None:
    try:
        parsed = parse_provider_json(raw_text)
        path.write_text(
            json.dumps(parsed, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except Exception as exc:
        log.warning("vision_prompt_log.parse_failed", path=str(path), error=str(exc))


def log_vision_pass_output(
    *,
    pass_kind: str,
    raw_text: str,
    session_id: str,
    page_number: int,
    model: str | None = None,
) -> None:
    """
    Persist one vision pass output.

    pass_kind: "floor_plan" | "correction"
    Writes:
      - latest_{pass_kind}_output.txt (+ .json when parseable)
      - history/{timestamp}_{session}_p{n}_{pass_kind}.txt (+ .json)
    """
    settings = get_settings()
    if not resolve_vision_prompt_log(settings):
        return

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S.%fZ")
    session_slug = _safe_session_slug(session_id)
    model_name = model or "unknown"

    header = "\n".join(
        [
            f"# pass={pass_kind}",
            f"# session_id={session_id}",
            f"# page_number={page_number}",
            f"# model={model_name}",
            f"# timestamp={stamp}",
        ]
    )

    log_dir = _resolve_log_dir()
    history_dir = log_dir / "history"
    base = f"{stamp}_{session_slug}_p{page_number}_{pass_kind}"

    try:
        _write_output(log_dir / f"latest_{pass_kind}_output.txt", header=header, raw_text=raw_text)
        _write_output(history_dir / f"{base}.txt", header=header, raw_text=raw_text)
        _write_parsed_json(log_dir / f"latest_{pass_kind}_output.json", raw_text)
        _write_parsed_json(history_dir / f"{base}.json", raw_text)
        log.info(
            "vision_prompt_log.written",
            pass_kind=pass_kind,
            page=page_number,
            session_id=session_id,
            dir=str(log_dir),
        )
    except OSError as exc:
        log.warning(
            "vision_prompt_log.write_failed",
            pass_kind=pass_kind,
            page=page_number,
            error=str(exc),
        )
