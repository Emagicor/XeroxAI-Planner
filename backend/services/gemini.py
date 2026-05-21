import base64
import json
import re

import google.generativeai as genai

from config.constants import GEMINI_MODEL
from config.settings import get_gemini_api_key


def configure_gemini() -> None:
    genai.configure(api_key=get_gemini_api_key())


def call_gemini(image_bytes: bytes, mime_type: str, prompt: str) -> str:
    configure_gemini()
    model = genai.GenerativeModel(GEMINI_MODEL)
    image_part = {
        "mime_type": mime_type,
        "data": base64.b64encode(image_bytes).decode(),
    }
    response = model.generate_content([prompt, image_part])
    return response.text.strip()


def parse_gemini_json(text: str) -> dict:
    cleaned = re.sub(r"```json|```", "", text).strip()
    return json.loads(cleaned)
