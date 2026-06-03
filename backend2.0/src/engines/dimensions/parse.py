"""
Parse dimension values from vision model output into feet (float).
"""
from __future__ import annotations

import re

_FEET_INCHES = re.compile(
    r"^\s*(\d+)\s*['\u2032\-]?\s*[-\s]?\s*(\d+(?:\.\d+)?)\s*(?:\"|\u2033)?\s*$"
)
_FEET_ONLY = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*['\u2032]?\s*$")
_METERS = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*m(?:eters?)?\s*$", re.I)
_CM = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*cm\s*$", re.I)
_MM = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*mm\s*$", re.I)


def parse_dimension_to_feet(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        return v if v > 0 else None
    if not isinstance(value, str):
        return None

    s = value.strip().replace("\u2032", "'").replace("\u2033", '"')
    if not s:
        return None

    m = _FEET_INCHES.match(s)
    if m:
        return float(m.group(1)) + float(m.group(2)) / 12.0

    m = _FEET_ONLY.match(s)
    if m:
        return float(m.group(1))

    m = _METERS.match(s)
    if m:
        return float(m.group(1)) * 3.28084

    m = _CM.match(s)
    if m:
        return float(m.group(1)) / 30.48

    m = _MM.match(s)
    if m:
        return float(m.group(1)) / 304.8

    try:
        v = float(s)
        return v if v > 0 else None
    except ValueError:
        return None
