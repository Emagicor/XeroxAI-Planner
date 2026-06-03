"""
providers/vision/base.py

Abstract interface every vision provider must implement.
The rest of the codebase only depends on this — never on a concrete provider.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProviderResponse:
    """Raw text back from the model, plus usage metadata for benchmarking."""
    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    model_used: str | None = None


class VisionProvider(ABC):
    """
    Contract for a multimodal vision provider.
    Implementations live in providers/vision/{gemini,openai}.py
    """

    @abstractmethod
    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
    ) -> ProviderResponse:
        """
        Send image + prompt to the model.

        Args:
            image_bytes: JPEG/PNG bytes of the preprocessed page
            mime_type: e.g. "image/jpeg"
            prompt: full instruction prompt

        Returns:
            ProviderResponse with raw model text + token counts

        Raises:
            ProviderError: on API error, rate limit (after retries), or timeout
        """
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Identifies the model for logging and benchmarking."""
        ...