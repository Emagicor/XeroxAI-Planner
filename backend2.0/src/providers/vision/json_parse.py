"""
Robust parsing of vision-model JSON output.

Models often return nearly-valid JSON with trailing commas, markdown fences,
or arithmetic expressions (e.g. 96 + 6/12) instead of plain numbers.
"""
from __future__ import annotations

import ast
import json
import operator
import re

from domain.exceptions import ProviderError

_FENCE_RE = re.compile(r"```(?:json)?|```", re.IGNORECASE)
_TRAILING_COMMA_RE = re.compile(r",\s*([}\]])")
_ARITH_VALUE_RE = re.compile(
    r"(?<=:)\s*"
    r"((?:-?\d+(?:\.\d+)?)"
    r"(?:\s*[+\-]\s*(?:-?\d+(?:\.\d+)?|\d+\s*/\s*\d+))+"
    r")"
    r"(?=\s*[,}\]])"
)
_SAFE_ARITH_RE = re.compile(r"^[\d+\-*/.()\s]+$")

_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}


def _safe_eval_arithmetic(expr: str) -> float:
    """Evaluate a simple numeric expression using AST (no eval())."""
    cleaned = expr.strip()
    if not _SAFE_ARITH_RE.match(cleaned):
        raise ValueError(f"unsafe arithmetic expression: {expr!r}")

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -_eval(node.operand)
        if isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in _BINOPS:
                raise ValueError(f"unsupported operator: {op_type}")
            return _BINOPS[op_type](_eval(node.left), _eval(node.right))
        raise ValueError(f"unsupported expression node: {type(node)}")

    tree = ast.parse(cleaned, mode="eval")
    return _eval(tree.body)


def _format_number(value: float) -> str:
    if value == int(value):
        return str(int(value))
    return str(round(value, 6))


def _normalize_arithmetic_values(text: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        expr = match.group(1)
        try:
            return " " + _format_number(_safe_eval_arithmetic(expr))
        except (ValueError, SyntaxError, ZeroDivisionError):
            return match.group(0)

    return _ARITH_VALUE_RE.sub(_replace, text)


def _extract_json_object(text: str) -> str:
    """Return the outermost {...} block when the model adds prose around JSON."""
    start = text.find("{")
    if start < 0:
        return text

    depth = 0
    in_string = False
    escape = False

    for index, char in enumerate(text[start:], start=start):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    return text[start:]


def _clean_model_json_text(text: str) -> str:
    cleaned = _FENCE_RE.sub("", text).strip()
    cleaned = _extract_json_object(cleaned)
    cleaned = _TRAILING_COMMA_RE.sub(r"\1", cleaned)
    cleaned = _normalize_arithmetic_values(cleaned)
    return cleaned


def parse_provider_json(text: str) -> dict:
    """
    Parse vision model output into a dict.

    Raises ProviderError(JSON_PARSE_ERROR) only when repair attempts fail.
    """
    cleaned = _clean_model_json_text(text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            code="JSON_PARSE_ERROR",
            message=(
                "Vision model returned malformed JSON. "
                "Please retry — the request may succeed on the next attempt."
            ),
            details={"raw_snippet": cleaned[:400], "parse_error": str(exc)},
        ) from exc

    if not isinstance(parsed, dict):
        raise ProviderError(
            code="JSON_PARSE_ERROR",
            message="Vision model JSON must be a single object.",
            details={"raw_snippet": cleaned[:400]},
        )

    return parsed
