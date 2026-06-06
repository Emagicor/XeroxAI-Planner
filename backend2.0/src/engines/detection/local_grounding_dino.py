"""
Local Grounding DINO (IDEA-Research repo) — no HuggingFace hub download.

Expects a checkout of https://github.com/IDEA-Research/GroundingDINO with SwinT
weights. The repo root is added to sys.path so `import groundingdino` works without
`pip install -e` (CUDA ops optional; CPU fallback is supported).
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path

import structlog

from config.settings import get_settings

log = structlog.get_logger(__name__)

# backend2.0/ (parent of src/)
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_BUNDLED_REPO = _BACKEND_ROOT / "groundingdino_local"
_DEFAULT_CONFIG = "groundingdino/config/GroundingDINO_SwinT_OGC.py"
_DEFAULT_WEIGHTS = "weights/groundingdino_swint_ogc.pth"

_model_lock = threading.Lock()
_local_model = None
_load_error: str | None = None
_repo_on_path: str | None = None


def resolve_grounding_dino_paths() -> tuple[Path, Path, Path]:
    """Return (repo_root, config_file, weights_file)."""
    settings = get_settings()
    if settings.grounding_dino_repo_path.strip():
        repo = Path(settings.grounding_dino_repo_path).expanduser().resolve()
    elif _BUNDLED_REPO.is_dir():
        repo = _BUNDLED_REPO
    else:
        repo = _BUNDLED_REPO

    config_rel = settings.grounding_dino_config_path.strip() or _DEFAULT_CONFIG
    weights_rel = settings.grounding_dino_weights_path.strip() or _DEFAULT_WEIGHTS

    config = Path(config_rel) if Path(config_rel).is_absolute() else repo / config_rel
    weights = Path(weights_rel) if Path(weights_rel).is_absolute() else repo / weights_rel
    return repo, config, weights


def _ensure_repo_importable(repo: Path) -> None:
    global _repo_on_path
    repo_str = str(repo)
    if not repo.is_dir():
        raise FileNotFoundError(f"Grounding DINO repo not found: {repo}")
    if _repo_on_path != repo_str:
        if repo_str not in sys.path:
            sys.path.insert(0, repo_str)
        _repo_on_path = repo_str


def _preprocess_caption(caption: str) -> str:
    result = caption.lower().strip()
    if result.endswith("."):
        return result
    return result + "."


def _load_local_model():
    global _local_model, _load_error
    if _local_model is not None or _load_error is not None:
        return

    with _model_lock:
        if _local_model is not None or _load_error is not None:
            return

        settings = get_settings()
        if not settings.grounding_dino_enabled:
            _load_error = "Grounding DINO disabled in settings"
            return

        repo, config, weights = resolve_grounding_dino_paths()
        try:
            _ensure_repo_importable(repo)
            if not config.is_file():
                raise FileNotFoundError(f"Config not found: {config}")
            if not weights.is_file():
                raise FileNotFoundError(
                    f"Weights not found: {weights} "
                    "(download groundingdino_swint_ogc.pth into weights/)"
                )

            import torch
            from groundingdino.models import build_model
            from groundingdino.util.misc import clean_state_dict
            from groundingdino.util.slconfig import SLConfig

            device = settings.grounding_dino_device
            if device == "cuda" and not torch.cuda.is_available():
                device = "cpu"

            log.info(
                "grounding_dino.local.loading",
                repo=str(repo),
                config=str(config),
                weights=str(weights),
                device=device,
            )
            args = SLConfig.fromfile(str(config))
            args.device = device
            model = build_model(args)
            checkpoint = torch.load(str(weights), map_location="cpu", weights_only=False)
            model.load_state_dict(clean_state_dict(checkpoint["model"]), strict=False)
            model.eval()
            if device == "cuda":
                model.to("cuda")
            else:
                model.to("cpu")
            _local_model = model
            log.info("grounding_dino.local.ready", device=device)
        except Exception as exc:
            _load_error = str(exc)
            log.warning("grounding_dino.local.load_failed", error=_load_error)


def local_model_available() -> bool:
    _load_local_model()
    return _local_model is not None


def local_model_status() -> dict:
    _load_local_model()
    repo, config, weights = resolve_grounding_dino_paths()
    return {
        "available": _local_model is not None,
        "error": _load_error,
        "backend": "local",
        "repo": str(repo),
        "config": str(config),
        "weights": str(weights),
        "config_exists": config.is_file(),
        "weights_exists": weights.is_file(),
    }


def predict_local_boxes(
    image_rgb,
    *,
    caption: str,
    box_threshold: float,
    text_threshold: float,
    device: str,
) -> list[tuple[tuple[int, int, int, int], float, str]]:
    """
    Run local Grounding DINO on a PIL RGB image.

    Returns [(x1, y1, x2, y2), score, label], pixel coordinates.
    """
    _load_local_model()
    if _local_model is None:
        raise RuntimeError(_load_error or "Local Grounding DINO not loaded")

    import torch
    import groundingdino.datasets.transforms as T
    from groundingdino.util.utils import get_phrases_from_posmap
    from torchvision.ops import box_convert

    if device == "cuda" and not torch.cuda.is_available():
        device = "cpu"

    w, h = image_rgb.size
    transform = T.Compose(
        [
            T.RandomResize([800], max_size=1333),
            T.ToTensor(),
            T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    tensor, _ = transform(image_rgb, None)
    caption = _preprocess_caption(caption)
    model = _local_model.to(device)
    tensor = tensor.to(device)

    with torch.no_grad():
        outputs = model(tensor[None], captions=[caption])

    prediction_logits = outputs["pred_logits"].cpu().sigmoid()[0]
    prediction_boxes = outputs["pred_boxes"].cpu()[0]

    mask = prediction_logits.max(dim=1)[0] > box_threshold
    logits = prediction_logits[mask]
    boxes = prediction_boxes[mask]

    tokenizer = model.tokenizer
    tokenized = tokenizer(caption)

    results: list[tuple[tuple[int, int, int, int], float, str]] = []
    scale = torch.tensor([w, h, w, h], dtype=torch.float32)
    for logit, box in zip(logits, boxes):
        phrase = get_phrases_from_posmap(
            logit > text_threshold, tokenized, tokenizer
        ).replace(".", "")
        score = float(logit.max().item())
        xyxy = box_convert(boxes=box * scale, in_fmt="cxcywh", out_fmt="xyxy")
        x1, y1, x2, y2 = [int(round(v)) for v in xyxy.tolist()]
        results.append(
            (
                (
                    max(0, min(x1, w)),
                    max(0, min(y1, h)),
                    max(0, min(x2, w)),
                    max(0, min(y2, h)),
                ),
                score,
                phrase or "floor plan",
            )
        )
    return results
