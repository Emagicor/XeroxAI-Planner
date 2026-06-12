"""
providers/vision/florence2.py — Microsoft Florence-2 via HuggingFace transformers.

Loads the model from the Hub on first use (lazy). Florence-2 uses fixed task
tokens (<OCR_WITH_REGION>, <MORE_DETAILED_CAPTION>, etc.); the pipeline prompt
is logged but inference uses FLORENCE2_TASK from settings.
"""
from __future__ import annotations

import io
import json
import threading
from dataclasses import dataclass

from config.settings import get_settings
from domain.exceptions import ProviderError
from providers.vision.base import ProviderResponse, TokenUsage, VisionProvider
from providers.vision.errors import classify_florence2_error
from providers.vision.retry import call_with_transient_retry

_DEFAULT_MODEL = "microsoft/Florence-2-large"
_VALID_TASKS = frozenset({
    "<CAPTION>",
    "<DETAILED_CAPTION>",
    "<MORE_DETAILED_CAPTION>",
    "<OCR>",
    "<OCR_WITH_REGION>",
    "<OD>",
    "<DENSE_REGION_CAPTION>",
    "<REGION_PROPOSAL>",
    "<CAPTION_TO_PHRASE_GROUNDING>",
    "<REFERRING_EXPRESSION_SEGMENTATION>",
    "<REGION_TO_SEGMENTATION>",
    "<OPEN_VOCABULARY_DETECTION>",
})

_model_lock = threading.Lock()
_model_cache: dict[tuple[str, str, str], "_ModelBundle"] = {}


@dataclass
class _ModelBundle:
    model: object
    processor: object
    device: str
    dtype: object


def _resolve_device(preference: str) -> str:
    pref = (preference or "auto").lower()
    if pref != "auto":
        return preference
    import torch

    return "cuda:0" if torch.cuda.is_available() else "cpu"


def _resolve_dtype(device: str):
    import torch

    if device.startswith("cuda"):
        return torch.float16
    return torch.float32


def _get_model_bundle(model_id: str, device: str, hf_token: str) -> _ModelBundle:
    cache_key = (model_id, device, hf_token or "")
    with _model_lock:
        cached = _model_cache.get(cache_key)
        if cached is not None:
            return cached

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoProcessor
    except ImportError as exc:
        raise ProviderError(
            code="FLORENCE2_ERROR",
            message=(
                "Florence-2 dependencies are not installed. "
                "Run: pip install torch transformers accelerate einops timm"
            ),
            details={"detail": str(exc)[:400]},
        ) from exc

    token = hf_token or None
    dtype = _resolve_dtype(device)
    processor = AutoProcessor.from_pretrained(
        model_id,
        trust_remote_code=True,
        token=token,
    )
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        torch_dtype=dtype,
        token=token,
    ).eval().to(device)

    bundle = _ModelBundle(model=model, processor=processor, device=device, dtype=dtype)
    with _model_lock:
        _model_cache[cache_key] = bundle
    return bundle


def clear_florence2_model_cache() -> None:
    """Drop cached Florence-2 weights after .env / model changes."""
    with _model_lock:
        _model_cache.clear()


def _resolve_task(task: str) -> str:
    normalized = (task or "<OCR_WITH_REGION>").strip()
    if normalized not in _VALID_TASKS:
        raise ProviderError(
            code="FLORENCE2_ERROR",
            message=(
                f"Invalid Florence-2 task '{normalized}'. "
                f"Use one of: {', '.join(sorted(_VALID_TASKS))}"
            ),
        )
    return normalized


class Florence2Provider(VisionProvider):

    def __init__(self, *, model: str | None = None) -> None:
        settings = get_settings()
        self._model_name = model or settings.florence2_model or _DEFAULT_MODEL
        self._task = _resolve_task(settings.florence2_task)
        self._device_pref = settings.florence2_device
        self._max_new_tokens = max(64, settings.florence2_max_new_tokens)
        self._hf_token = settings.huggingface_token
        self._transient_retries = 0

    @property
    def model_name(self) -> str:
        return self._model_name

    def _call_once(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> ProviderResponse:
        import torch
        from PIL import Image

        device = _resolve_device(self._device_pref)
        bundle = _get_model_bundle(self._model_name, device, self._hf_token)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        task_prompt = self._task
        inputs = bundle.processor(
            text=task_prompt,
            images=image,
            return_tensors="pt",
        )
        input_ids = inputs["input_ids"].to(bundle.device)
        pixel_values = inputs["pixel_values"].to(bundle.device, bundle.dtype)
        prompt_token_count = int(input_ids.shape[1])

        with torch.inference_mode():
            generated_ids = bundle.model.generate(
                input_ids=input_ids,
                pixel_values=pixel_values,
                max_new_tokens=self._max_new_tokens,
                num_beams=3,
                do_sample=False,
            )

        generated_text = bundle.processor.batch_decode(
            generated_ids, skip_special_tokens=False
        )[0]
        parsed = bundle.processor.post_process_generation(
            generated_text,
            task=task_prompt,
            image_size=(image.width, image.height),
        )

        completion_tokens = max(0, int(generated_ids.shape[1]) - prompt_token_count)
        usage = TokenUsage(
            prompt_token_count=prompt_token_count,
            candidates_token_count=completion_tokens,
            total_token_count=prompt_token_count + completion_tokens,
        )

        # Florence-2 returns structured vision output, not floor-plan JSON.
        text = json.dumps(
            {
                "florence2_task": task_prompt,
                "florence2_model": self._model_name,
                "florence2_result": parsed,
            },
            default=str,
        )

        return ProviderResponse(
            text=text,
            input_tokens=usage.prompt_token_count,
            output_tokens=usage.candidates_token_count,
            model_used=self._model_name,
            usage=usage,
        )

    def _raise_provider_error(self, exc: Exception) -> None:
        code, message = classify_florence2_error(exc, model=self._model_name)
        raise ProviderError(
            code=code,
            message=message,
            details={"model": self._model_name, "detail": str(exc)[:400]},
        ) from exc

    def analyze_image(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> ProviderResponse:
        return call_with_transient_retry(
            lambda: self._call_once(image_bytes, mime_type, prompt),
            transient_retries=self._transient_retries,
            on_error=self._raise_provider_error,
        )
