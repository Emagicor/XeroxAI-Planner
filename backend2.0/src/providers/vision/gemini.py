"""

providers/vision/gemini.py



Each vision call uses a new GenerativeModel instance (no chat history reuse).

Quota errors fail immediately (no retry storm). Transient errors retry at most once.

"""

from __future__ import annotations



import base64

import json

import re

import time



import google.generativeai as genai



from config.settings import get_settings

from domain.exceptions import ProviderError

from providers.vision.base import ProviderResponse, VisionProvider

from providers.vision.errors import (

    is_quota_exceeded,

    is_transient_error,

    parse_retry_after_seconds,

    quota_user_message,

)



SYSTEM_INSTRUCTION = (

    "You analyze ONE architectural sheet image per request. "

    "Each request is independent — ignore any prior images, sessions, or JSON outputs. "

    "Never reuse room data from another document."

)





class GeminiProvider(VisionProvider):



    def __init__(self) -> None:

        settings = get_settings()

        if not settings.gemini_api_key:

            raise ProviderError(

                code="MISSING_API_KEY",

                message="GEMINI_API_KEY is not set. Add it to your .env file.",

            )

        self._model_name = settings.gemini_model

        self._benchmark = settings.benchmark_mode

        self._transient_retries = max(0, settings.gemini_transient_retries)

        genai.configure(api_key=settings.gemini_api_key)



    @property

    def model_name(self) -> str:

        return self._model_name



    def _new_model(self) -> genai.GenerativeModel:

        """Fresh model per call — avoids implicit multi-turn state on reused handles."""

        return genai.GenerativeModel(

            model_name=self._model_name,

            system_instruction=SYSTEM_INSTRUCTION,

            generation_config=genai.GenerationConfig(

                temperature=0,

                top_p=1,

            ),

        )



    def _generate_once(

        self,

        image_bytes: bytes,

        mime_type: str,

        prompt: str,

    ) -> ProviderResponse:

        model = self._new_model()

        image_part = {

            "mime_type": mime_type,

            "data": base64.b64encode(bytes(image_bytes)).decode(),

        }

        response = model.generate_content([prompt, image_part])

        text = (response.text or "").strip()



        input_tokens = output_tokens = None

        if self._benchmark:

            try:

                meta = response.usage_metadata

                input_tokens = getattr(meta, "prompt_token_count", None)

                output_tokens = getattr(meta, "candidates_token_count", None)

            except Exception:

                pass



        return ProviderResponse(

            text=text,

            input_tokens=input_tokens,

            output_tokens=output_tokens,

            model_used=self._model_name,

        )



    def _raise_provider_error(self, exc: Exception) -> None:

        if is_quota_exceeded(exc):

            raise ProviderError(

                code="QUOTA_EXCEEDED",

                message=quota_user_message(self._model_name),

                details={"model": self._model_name, "detail": str(exc)[:400]},

            ) from exc

        raise ProviderError(

            code="GEMINI_ERROR",

            message=str(exc),

            details={"model": self._model_name, "detail": str(exc)[:400]},

        ) from exc



    def analyze_image(

        self,

        image_bytes: bytes,

        mime_type: str,

        prompt: str,

    ) -> ProviderResponse:

        attempts = 1 + self._transient_retries

        last_exc: Exception | None = None



        for attempt in range(attempts):

            try:

                return self._generate_once(image_bytes, mime_type, prompt)

            except ProviderError:

                raise

            except Exception as exc:

                last_exc = exc

                if is_quota_exceeded(exc):

                    self._raise_provider_error(exc)



                if attempt < attempts - 1 and is_transient_error(exc):

                    delay = parse_retry_after_seconds(exc) or 5.0

                    time.sleep(delay)

                    continue



                self._raise_provider_error(exc)



        assert last_exc is not None

        self._raise_provider_error(last_exc)





def parse_provider_json(text: str) -> dict:

    cleaned = re.sub(r"```(?:json)?|```", "", text).strip()

    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)

    try:

        return json.loads(cleaned)

    except json.JSONDecodeError as exc:

        raise ProviderError(

            code="JSON_PARSE_ERROR",

            message=f"Model returned invalid JSON: {exc}",

            details={"raw_snippet": cleaned[:300]},

        ) from exc


