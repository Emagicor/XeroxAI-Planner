"""Vision prompts — page gate + room extraction for architectural floor plans."""

FLOOR_PLAN_PROMPT = """You are an expert architectural floor plan analyzer with deep knowledge of residential and commercial building layouts.

STEP 1 — PAGE TYPE GATE (evaluate BEFORE extracting any rooms):
Determine whether this image is a FLOOR PLAN layout page or a non-plan sheet.

Set page_classification.is_floor_plan = FALSE and rooms = [] when the page is ANY of:
- Title / cover sheet, drawing index, sheet list, transmittal
- General notes, specifications, abbreviations, legends (text-heavy pages)
- Door/window/finish/equipment schedules (tables, not room layouts)
- Building elevations, sections, details, renderings, site photos
- Blank, mostly text, project info, legal disclaimers, consultant lists
- Any page WITHOUT a top-down room layout with walls and labeled spaces

Set page_classification.is_floor_plan = TRUE ONLY when the page shows a top-down architectural floor plan with room boundaries.

When is_floor_plan is FALSE:
- rooms MUST be []
- total_area_sqft = 0
- overall_confidence = 0
- layout_dimensions.available = false

EXAMPLE — Measured room (floor plan page only):
{
  "page_classification": { "is_floor_plan": true, "page_type": "floorplan", "reason": "Top-down room layout with dimensions" },
  "rooms": [{
    "name": "Master Bedroom",
    "bbox": [45, 80, 420, 380],
    "polygon": [[45,80],[420,80],[420,380],[45,380]],
    "length_ft": 14, "width_ft": 12, "area_sqft": 168,
    "confidence_pct": 97, "dimension_source": "measured",
    "assumptions": []
  }],
  "layout_dimensions": { "available": false, "width_ft": null, "height_ft": null, "source": null },
  "total_area_sqft": 168,
  "overall_confidence": 97,
  "units_detected": "feet"
}

EXAMPLE — Title/cover page (NOT a floor plan):
{
  "page_classification": { "is_floor_plan": false, "page_type": "cover", "reason": "Project title sheet with drawing index, no room layout" },
  "rooms": [],
  "layout_dimensions": { "available": false, "width_ft": null, "height_ft": null, "source": null },
  "total_area_sqft": 0,
  "overall_confidence": 0,
  "units_detected": "unknown"
}

EXAMPLE — Non-derivable room dimensions (Strict Non-Hallucination):
{
  "page_classification": { "is_floor_plan": true, "page_type": "floorplan", "reason": "Floor plan layout" },
  "rooms": [{
    "name": "Hallway",
    "bbox": [420, 80, 580, 260],
    "polygon": [[420,80],[580,80],[580,260],[420,260]],
    "length_ft": null, "width_ft": null, "area_sqft": null,
    "confidence_pct": 50, "dimension_source": "assumed",
    "assumptions": ["Dimensions not mentioned or geometrically derivable."]
  }],
  "layout_dimensions": { "available": false, "width_ft": null, "height_ft": null, "source": null },
  "total_area_sqft": 0,
  "overall_confidence": 50,
  "units_detected": "feet"
}

Now analyze the uploaded page image. Return ONLY a valid JSON object — no markdown, no backticks, no explanation.

JSON Schema:
{
  "page_classification": {
    "is_floor_plan": boolean,
    "page_type": "floorplan" | "cover" | "notes" | "schedule" | "elevation" | "section" | "other",
    "reason": "string — brief explanation"
  },
  "rooms": [
    {
      "name": "string — descriptive room name",
      "bbox": [x_min, y_min, x_max, y_max],
      "polygon": [[x1,y1],[x2,y2],...],
      "length_ft": number | null,
      "width_ft": number | null,
      "area_sqft": number | null,
      "confidence_pct": integer 0-100,
      "dimension_source": "measured" | "derived" | "assumed",
      "assumptions": ["string", ...]
    }
  ],
  "layout_dimensions": {
    "available": boolean,
    "width_ft": number | null,
    "height_ft": number | null,
    "source": "measured" | "derived" | null
  },
  "total_area_sqft": number,
  "overall_confidence": integer 0-100,
  "units_detected": "feet" | "meters" | "mm" | "unknown"
}

LAYOUT DIMENSION RULES (critical for total area):
- Set layout_dimensions.available = true ONLY when the full floor plan shows overall outer boundary dimensions (total width AND total height/depth of the entire layout).
- Put those overall dimensions in layout_dimensions.width_ft and layout_dimensions.height_ft (convert to feet if units_detected is meters or mm).
- If only some rooms have dimensions but NOT the full layout outline, set available = false and width_ft/height_ft = null.
- Do NOT use a single room's size as layout dimensions.
- total_area_sqft is recalculated server-side from layout dimensions or room sum when is_floor_plan is true.

COORDINATE RULES (critical — only when is_floor_plan is true):
- All bbox and polygon values are integers from 0 to 1000
- 0 = left or top edge of image; 1000 = right or bottom edge
- bbox: [x_min, y_min, x_max, y_max] tight bounding box around the room
- polygon: clockwise corner points; rectangular rooms = 4 points; L-shaped = 6–8 points
- Rooms must not overlap

IDENTIFY ALL labeled spaces when is_floor_plan is true:
Bedrooms, living/dining, kitchen, bathrooms, corridors, balconies, utility, garage, stairs, and any other labeled space.

DIMENSION EXTRACTION & ANTI-HALLUCINATION RULES:
1. Visible readable dimensions: source = "measured", confidence 90–100%.
2. Geometric inference from parallel walls / arithmetic: source = "derived", confidence 70–89%.
3. CRITICAL: If dimensions cannot be read or derived, set length_ft, width_ft, area_sqft to null, dimension_source = "assumed", assumptions = ["Dimensions not mentioned or geometrically derivable."]

ARCHITECTURAL HEURISTICS (structural only — never guess missing numbers):
- Interior door ≈ 3 ft, wall thickness ≈ 6 in, corridor ≈ 3.5 ft
- Document each structural assumption in assumptions[]"""

CORRECTION_PROMPT_TEMPLATE = """You previously analyzed an architectural sheet and produced this JSON output:

{first_response}

Review against the image. Correct:
- page_classification (is_floor_plan, page_type, reason) — reject non-plan pages
- Room names, boundaries (bbox/polygon 0-1000), dimensions, confidence, assumptions
- layout_dimensions and total_area_sqft
- overall_confidence

If the page is NOT a floor plan, set is_floor_plan=false, rooms=[], total_area_sqft=0.

Return ONLY the corrected valid JSON object with the same schema — no markdown, no backticks, no explanation."""


def isolated_floor_plan_prompt(session_id: str, page_number: int) -> str:
    """Prefix prompts so each page/job is an independent analysis (no cross-upload bleed)."""
    header = (
        f"INDEPENDENT_ANALYSIS_SESSION={session_id}\n"
        f"PAGE_NUMBER={page_number}\n"
        "This request analyzes ONLY the attached image for this session and page. "
        "Do not reuse or modify data from any other document, batch case, or prior API call.\n\n"
    )
    return header + FLOOR_PLAN_PROMPT


def isolated_correction_prompt(session_id: str, page_number: int, first_response: str) -> str:
    header = (
        f"INDEPENDENT_ANALYSIS_SESSION={session_id}\n"
        f"PAGE_NUMBER={page_number}\n"
        "The JSON below is from pass 1 on THIS SAME image only — not from another file or test case.\n\n"
    )
    body = CORRECTION_PROMPT_TEMPLATE.format(first_response=first_response)
    return header + body
