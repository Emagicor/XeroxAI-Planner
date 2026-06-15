"""Vision prompts — page gate + room extraction for architectural floor plans."""
from __future__ import annotations

import json

from engines.confidence.correction_targets import CorrectionTargets

FLOOR_PLAN_PROMPT = """You are an expert architectural floor plan analyzer.

## STEP 1 — PAGE GATE
Set is_floor_plan = false and rooms = [] if the page is ANY of:
title/cover, drawing index, notes, specs, abbreviations, legends, schedules, elevations, sections, details, renderings, site photos, blank, or text-heavy pages WITHOUT a top-down room layout with walls and labeled spaces.

Set is_floor_plan = true ONLY for top-down architectural floor plans with room boundaries.

## STEP 2 — FLOOR IDENTIFICATION
Identify the floor level from labels/title blocks. Use: Ground Floor, First Floor, Second Floor, Third Floor, Basement, Mezzanine, Roof Plan, Typical Floor, Unit Plan, or Unknown. Do not guess.

## ANTI-HALLUCINATION (highest priority — read before extracting anything)
- Unit detection is critical. Ensure units_detected matches the actual dimension units shown on the drawing.
- Output a dimension ONLY when you can point to specific dimension text on the image for that axis, OR when annotated arithmetic yields exactly one answer.
- Never infer from furniture, scale bars, room numbers, sheet numbers, title blocks, or visual proportions.
- Never use standard sizes to fabricate missing dimensions.
- Wrong numbers are worse than missing rooms — when uncertain, omit the room.

## DIMENSION SOURCES & CONFIDENCE (drives selective correction pass)
Assign honest confidence_pct per room. Downstream correction re-reads ONLY rooms at/below the high-confidence cutoff.

**measured** (confidence_pct 90–100): Dimension string is clearly readable and tied to that room via leader line, chain, or area callout. Copy exactly. These rooms are frozen after pass 1.
**derived** (confidence_pct 70–89): ALL input numbers are themselves measured AND arithmetic yields one unambiguous result (e.g. subtraction along a row, shared-wall transfer). Document full arithmetic in assumptions[]. Dimension fields will be re-verified in correction.
**assumed** (confidence_pct below 70): Use only when data is uncertain. Full room will be re-verified or removed in correction.
**area-only**: Area annotated (e.g. "168 SF") but no L×W → set area_sqft, leave length_ft/width_ft null, source = "measured", confidence_pct 90+ only when area text is clearly readable.

## ROOM RULES
- Include ONLY rooms with at least one measured/derived dimension or measured area.
- Label without dimensions → omit. Dimensions without label → include with descriptive fallback name.
- Copy room labels exactly as printed (spelling, caps, abbreviations, punctuation).
## LAYOUT DIMENSIONS
Set available = true ONLY when full outer boundary dimensions (total width AND height) are annotated. Do NOT use a single room's size as layout dimensions.

## DIMENSION NOTATION
Imperial: 17'11" → 17 + 11/12 ft. ½ symbol = 0.5 in.
Metric: mm ÷ 304.8 = ft; m × 3.281 = ft.
All numeric JSON fields must be plain numbers (e.g. 96.5), never arithmetic expressions (not 96 + 6/12).

## OUTPUT
Return ONLY valid JSON — no markdown, no backticks, no explanation.

{
  "page_classification": {
    "is_floor_plan": boolean,
    "page_type": "floorplan"|"cover"|"notes"|"schedule"|"elevation"|"section"|"other",
    "reason": string
  },
  "floor_identification": {
    "floor_label": string,
    "confidence_pct": integer,
    "evidence": string
  },
  "rooms": [{
    "name": string,
    "length_ft": number|null,
    "width_ft": number|null,
    "area_sqft": number|null,
    "confidence_pct": integer,
    "dimension_source": "measured"|"derived"|"assumed",
    "assumptions": [string]
  }],
  "layout_dimensions": {
    "available": boolean,
    "width_ft": number|null,
    "height_ft": number|null,
    "source": "measured"|"derived"|null
  },
  "total_area_sqft": number,
  "overall_confidence": integer,
  "units_detected": "feet"|"meters"|"mm"|"unknown"
}

When is_floor_plan is false: rooms=[], total_area_sqft=0, overall_confidence=0, layout_dimensions.available=false."""


SELECTIVE_CORRECTION_PROMPT_TEMPLATE = """Pass-1 extraction summary for this same image:

{targets_json}

## Task A — verify flagged rooms (if rooms_to_verify is non-empty)
- Treat pass-1 "current" values as unverified — re-read the image for each fields_to_verify entry.
- If the image disagrees, return action "update" with corrected values and updated confidence_pct.
- If the image confirms pass-1, omit that room from room_corrections (no rubber-stamping in the payload).
- action "remove": dimensions cannot be verified — drop the room (do not invent replacements).
- Do not return high-confidence pass-1 rooms unchanged in room_corrections.

## Task B — find missed rooms (when scan_for_missed_rooms is true)
- Scan the image for labeled spaces with measurable dimensions or annotated area that are NOT in existing_room_names.
- Add only rooms you can verify from the image (same anti-hallucination rules as pass 1).
- Do not duplicate rooms already in existing_room_names (case-insensitive).
- Each rooms_added entry needs: name, length_ft/width_ft or area_sqft, confidence_pct, dimension_source, assumptions.

General:
- Do not adjust values to make totals or adjacent rooms fit.
- rooms_added may be [] when nothing was missed.

Return ONLY valid JSON — no markdown, no backticks, no explanation:
{{
  "room_corrections": [{{
    "room_index": integer,
    "action": "update"|"remove",
    "name": string|null,
    "length_ft": number|null,
    "width_ft": number|null,
    "area_sqft": number|null,
    "confidence_pct": integer,
    "dimension_source": "measured"|"derived"|"assumed",
    "assumptions": [string]
  }}],
  "rooms_added": [{{
    "name": string,
    "length_ft": number|null,
    "width_ft": number|null,
    "area_sqft": number|null,
    "confidence_pct": integer,
    "dimension_source": "measured"|"derived",
    "assumptions": [string]
  }}],
  "floor_identification": {{
    "floor_label": string,
    "confidence_pct": integer,
    "evidence": string
  }}|null
}}"""

# Fallback when pass-1 JSON is structurally empty/invalid — full re-read (rare).
CORRECTION_PROMPT_TEMPLATE = """Pass-1 output for this same image:

{first_response}

Re-read every dimension from the image and correct the JSON. Rules:
- Do not assume pass-1 is correct — change any value the image contradicts.
- Verify each number against the image. Do not trust pass-1 values without re-reading them.
- Remove any room whose dimensions cannot be verified as measured or unambiguously derived.
- Do not adjust values to make totals or adjacent rooms fit. Delete wrong values, do not replace with guesses.
- Do not add rooms not in pass-1 unless clearly readable on the image.

Return ONLY the corrected valid JSON — same schema, no markdown, no backticks, no explanation."""


def isolated_floor_plan_prompt(session_id: str, page_number: int) -> str:
    header = (
        f"SESSION={session_id} PAGE={page_number}\n"
        "Analyze ONLY the attached image. Do not reuse data from any other document or prior call.\n\n"
    )
    return header + FLOOR_PLAN_PROMPT


def isolated_selective_correction_prompt(
    session_id: str,
    page_number: int,
    targets: CorrectionTargets,
) -> str:
    header = (
        f"SESSION={session_id} PAGE={page_number}\n"
        "Verify ONLY the flagged low-confidence fields from pass 1 on this same image.\n\n"
    )
    targets_json = json.dumps(
        targets.to_prompt_payload(),
        ensure_ascii=True,
        separators=(",", ":"),
    )
    return header + SELECTIVE_CORRECTION_PROMPT_TEMPLATE.format(targets_json=targets_json)


def isolated_correction_prompt(session_id: str, page_number: int, first_response: str) -> str:
    header = (
        f"SESSION={session_id} PAGE={page_number}\n"
        "The JSON below is from pass 1 on this same image only.\n\n"
    )
    return header + CORRECTION_PROMPT_TEMPLATE.format(first_response=first_response)