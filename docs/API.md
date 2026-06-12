# API Reference

Base URL (local): `http://localhost:5000`

Interactive docs (development only): `http://localhost:5000/docs`

All analyze endpoints accept `multipart/form-data` with a `file` field.

---

## Health

### `GET /health`

Returns service status and vision provider configuration.

**Response 200**

```json
{
  "status": "ok",
  "env": "development",
  "vision_provider": "gemini",
  "gemini": {
    "configured": true,
    "model": "gemini-2.5-flash",
    "key_fingerprint": "a1b2c3d4e5f6",
    "env_file": "/path/to/backend2.0/.env"
  }
}
```

---

## Analyze

### `POST /analyze`

Processes the entire document synchronously. Recommended for single images and small PDFs (≤ ~10 pages).

**Form fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Floor plan (PDF, PNG, JPG, WEBP) |
| `vision_provider` | string | No | Override: `gemini`, `openai`, `groq` |
| `vision_model` | string | No | Override model ID for extraction pass |

**Response 200** — `AnalyzeResponseSchema`

```json
{
  "job_id": "uuid",
  "filename": "plan.pdf",
  "content_sha256": "hex",
  "status": "complete",
  "total_pages": 3,
  "source_page_count": 2,
  "total_regions": 3,
  "scenario": "single_pdf_multi_page_multi_floorplan",
  "pages": [ /* PageSchema[] */ ],
  "grand_total_sqft": 2450.5,
  "eligible_pages": 2,
  "ineligible_pages": 1,
  "has_assumed": true,
  "has_low_confidence": false,
  "created_at": "2026-06-11T08:00:00Z"
}
```

**Error responses**

| Status | When |
|--------|------|
| 400 | Missing or empty file |
| 422 | Ingestion failure (invalid extension, too large, corrupt PDF, etc.) |
| 503 | Vision provider error (missing key, quota, model not found) |
| 500 | Internal pipeline failure |

Error body:

```json
{
  "detail": {
    "code": "QUOTA_EXCEEDED",
    "message": "Human-readable description"
  }
}
```

---

### `POST /analyze/stream`

Server-Sent Events endpoint. Emits one event per detected analysis region. Use for large or multi-region documents.

**Form fields:** Same as `POST /analyze`

**Response:** `text/event-stream`

Event types:

| Type | Payload | Description |
|------|---------|-------------|
| `detected` | `total_regions`, `source_page_count`, `scenario` | Region count before processing |
| `progress` | `page`, `total_pages`, `data` (PageSchema) | One region completed |
| `done` | `grand_total_sqft`, `eligible_pages`, `ineligible_pages` | Stream finished |
| `error` | `message` | Fatal stream error |

Example event:

```
data: {"type":"progress","page":1,"total_pages":3,"data":{...}}

```

Annotated images are included inline in each `progress` event's `data.annotated_image` (base64 JPEG).

---

### `GET /analyze/{job_id}/pages/{page_number}/annotated`

Returns annotated JPEG for a completed job page. Used when the main response omits inline images (multi-page blocking analyze).

**Response 200:** `image/jpeg`

**Response 404:** Job or page not found

---

## Export

Requires a completed job ID from a prior analyze request.

### `POST /export/csv`

### `POST /export/xlsx`

**Request body (JSON)**

```json
{
  "job_id": "uuid-from-analyze-response",
  "unit": "sqft"
}
```

`unit` values: `sqft` (default), `sqm`, `sq-in`, `sq-cm`

**Response 200:** File download with appropriate `Content-Disposition` header.

**Response 404:** Job not found

---

## Schemas

### PageSchema

| Field | Type | Description |
|-------|------|-------------|
| `page_number` | int | Sequential plan index |
| `plan_number` | int | Alias for display |
| `page_type` | string | `floorplan`, `elevation`, `notes`, etc. |
| `eligible` | bool | Whether rooms were extracted |
| `floor_label` | string? | e.g., "First Floor" |
| `ineligible_reason` | string? | Why page was skipped |
| `rooms` | RoomSchema[] | Detected rooms |
| `total_area_sqft` | float | Page total area |
| `total_area_source` | string | `room_sum` or `layout_dimensions` |
| `overall_confidence` | int | 0–100 |
| `units_detected` | string | e.g., `feet` |
| `annotated_image` | string? | Base64 JPEG (when inline) |
| `source_page` | int? | Original PDF page |
| `region_index` | int? | Region on source page |
| `clip_preview` | string? | Base64 preview of clipped region |

### RoomSchema

| Field | Type | Description |
|-------|------|-------------|
| `room_id` | string | UUID |
| `name` | string | Room label |
| `bbox` | int[4] | `[x_min, y_min, x_max, y_max]` 0–1000 |
| `polygon` | int[][] | Clockwise vertices |
| `length_ft` | float? | Length in feet |
| `width_ft` | float? | Width in feet |
| `area_sqft` | float? | null for assumed-only rooms |
| `confidence_pct` | int | 0–100 |
| `dimension_source` | string | `measured`, `derived`, `assumed` |
| `assumptions` | string[] | Heuristics applied |
| `is_assumed` | bool | Derived from dimension_source |

### Scenario Values

Inferred from document structure:

| Scenario | Condition |
|----------|-----------|
| `single_image_single_floorplan` | One image, one region |
| `single_image_multi_floorplan` | One image, multiple regions |
| `single_pdf_single_page` | PDF, one page, one region |
| `single_pdf_multi_page` | PDF, multiple pages, one region each |
| `single_pdf_multi_page_multi_floorplan` | PDF with multi-region pages |
| `mixed` | Fallback |

---

## Ingestion Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_EXTENSION` | 422 | Unsupported file type |
| `INVALID_MIME_TYPE` | 422 | Content does not match extension |
| `FILE_TOO_LARGE` | 422 | Exceeds `MAX_UPLOAD_MB` |
| `TOO_MANY_PAGES` | 422 | PDF exceeds `MAX_PDF_PAGES` |
| `CORRUPT_PDF` | 422 | Unreadable PDF |
| `PASSWORD_PROTECTED` | 422 | Encrypted PDF |
| `MALWARE_SUSPECTED` | 422 | Suspicious embedded content |
| `EMPTY_FILE` | 422 | Zero-byte upload |

## Vision Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_API_KEY` | 503 | Provider key not configured |
| `INVALID_API_KEY` | 503 | Authentication failed |
| `QUOTA_EXCEEDED` | 503 | Rate or quota limit hit |
| `MODEL_NOT_FOUND` | 503 | Invalid model ID |
| `GEMINI_ERROR` / `OPENAI_ERROR` / `GROQ_ERROR` | 503 | Provider-specific failure |
| `VISION_PROVIDER_ERROR` | 503 | Generic provider failure |
