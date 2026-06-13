"""
providers/vision/base.py

Abstract interface every vision provider must implement.
The rest of the codebase only depends on this — never on a concrete provider.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TokenUsage:
    """Provider usage metadata — Gemini usageMetadata field names preserved in logs."""

    prompt_token_count: int | None = None
    candidates_token_count: int | None = None
    thoughts_token_count: int | None = None
    total_token_count: int | None = None

    def as_log_fields(self) -> dict[str, int | None]:
        return {
            "promptTokenCount": self.prompt_token_count,
            "candidatesTokenCount": self.candidates_token_count,
            "thoughtsTokenCount": self.thoughts_token_count,
            "totalTokenCount": self.total_token_count,
        }

    def add(self, other: TokenUsage | None) -> TokenUsage:
        if other is None:
            return self

        def _sum(a: int | None, b: int | None) -> int | None:
            if a is None and b is None:
                return None
            return (a or 0) + (b or 0)

        return TokenUsage(
            prompt_token_count=_sum(self.prompt_token_count, other.prompt_token_count),
            candidates_token_count=_sum(
                self.candidates_token_count, other.candidates_token_count
            ),
            thoughts_token_count=_sum(self.thoughts_token_count, other.thoughts_token_count),
            total_token_count=_sum(self.total_token_count, other.total_token_count),
        )


@dataclass
class ProviderResponse:
    """Raw text back from the model, plus usage metadata."""
    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    model_used: str | None = None
    usage: TokenUsage | None = None


class VisionProvider(ABC):
    """
    Contract for a multimodal vision provider.
    Implementations live in providers/vision/{gemini,openai,groq}.py
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