# Architecture

## Overview

ZeroxAI follows a layered backend architecture with a React single-page frontend. Analysis runs in isolated subprocesses to prevent vision SDK state bleed between consecutive uploads.

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                        │
│  Analyze mode │ Test Suite mode │ Export / Review UI            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼─────────────────────────────────────┐
│  API Layer (FastAPI)                                            │
│  /health  /analyze  /analyze/stream  /export/*                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  Application                                                    │
│  analyze_orchestrator │ job_store (in-memory)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  Pipelines                                                      │
│  ingestion → rasterizer → region_expander → page_processor      │
│            → page_analyzer (vision) → page_result_mapper        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Vision Providers    Engines (detection,     Infrastructure
   Gemini/OpenAI/Groq  dimensions, validation) (annotations, export)
```

## Analysis Pipeline

Each upload progresses through the stages below. Failures at ingestion raise typed domain exceptions; per-page failures in streaming mode do not abort the entire job.

### 1. Ingestion

**Module:** `pipelines/ingestion/file_validator.py`

- Validates extension, MIME type (from file bytes), size, and PDF page count
- Scans for suspicious PDF/JavaScript and malformed image payloads
- Rejects password-protected or corrupt PDFs

Supported formats: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`

### 2. Rasterization

**Module:** `infrastructure/rasterizer/pdf_rasterizer.py`

- PDF pages rendered via **PyMuPDF** at configurable DPI (default 300)
- Output format: lossless PNG (recommended for color fidelity)
- Single images pass through as one rasterized page

### 3. Page Expansion

**Module:** `pipelines/processing/region_expander.py`, `engines/detection/region_clipper.py`

- Classifies each rasterized page and skips non-plan sheets (cover, notes, schedules)
- Treats each eligible page as one full-page analysis unit
- Assigns `source_page`, `region_index`, and sequential `plan_number`

### 4. Page Classification

**Module:** `pipelines/processing/page_classifier.py`

- Pre-vision heuristics skip non-plan pages (cover, notes, schedules, elevations)
- Vision model may reclassify via `page_classification` in its JSON response

### 5. Vision Extraction

**Module:** `pipelines/extraction/page_analyzer.py`

Per analysis unit:

1. **Preprocess** — upscale (min 1800px), contrast enhancement, optional deskew
2. **Pass 1** — floor plan prompt → strict JSON (rooms, bboxes, polygons, dimensions)
3. **Pass 2 (conditional)** — correction prompt when pass 1 is invalid or empty
4. **Sanitize** — dimension parsing, unit normalization, area computation
5. **Validate** — schema and business rules via `engines/validation/`
6. **Annotate** — draw overlays on the preprocessed image the model saw

Vision calls are serialized via `VISION_API_LOCK` to avoid provider rate-limit collisions.

### 6. Result Assembly

**Module:** `pipelines/processing/page_result_mapper.py`

- Maps raw vision JSON to domain entities (`PageResult`, `RoomResult`)
- Computes page totals, grand totals, confidence aggregates
- Base64-encodes annotated JPEG; clip preview for multi-region UI

### 7. Response & Persistence

- **Blocking** (`POST /analyze`): full job JSON; annotated image inline for single-page jobs
- **Streaming** (`POST /analyze/stream`): SSE events per region; annotated images inline per event
- **On-demand** (`GET /analyze/{job_id}/pages/{n}/annotated`): fetch large images separately
- Jobs stored in-memory (`job_store`) for export and annotated image retrieval

## Domain Model

| Entity | Purpose |
|--------|---------|
| `AnalyzeJob` | Top-level job: filename, SHA-256, status, pages, grand total |
| `PageResult` | One analyzed region: rooms, eligibility, annotated image |
| `RoomResult` | Room name, bbox/polygon (0–1000 scale), dimensions, confidence |

**Dimension sources:**

| Source | Confidence | Meaning |
|--------|------------|---------|
| `measured` | 90–100% | Dimension text visible on plan |
| `derived` | 70–89% | Calculated from visible dimensions |
| `assumed` | 40–69% | Architectural heuristics applied |

Coordinates use a normalized **0–1000** integer scale relative to image edges.

## Vision Provider Abstraction

**Module:** `providers/vision/`

All providers implement `VisionProvider.analyze_image()`. The factory resolves provider and model from:

- Environment defaults (`VISION_PROVIDER`, `GEMINI_MODEL`, etc.)
- Per-request form fields (`vision_provider`, `vision_model`)
- Separate correction pass settings (`VISION_CORRECTION_PROVIDER`, `VISION_CORRECTION_MODEL`)

Supported providers: **gemini**, **openai**, **groq**

## Frontend Architecture

```
src/
├── app/App.jsx              # Mode routing (Analyze vs Test Suite)
├── hooks/                   # useFloorPlanAnalysis, useTestSuiteBatch
├── services/                # analyzeApi, analyzeStreamApi
├── stores/                  # apiStore (base URL), toastStore
└── components/
    ├── upload/              # File drop, preview
    ├── analysis/            # Streaming progress
    ├── plan/                # Annotated images, room tables
    ├── results/             # Summary, review table, exports
    └── test-suite/          # Batch QA UI
```

**Streaming strategy:** PDFs and multi-region documents use `POST /analyze/stream` (SSE). Single images use blocking `POST /analyze`.

The Vite dev server includes a test-suite plugin (`vite.testSuitePlugin.js`) that exposes local CRUD for cases and run history under `/api/test-suite/*`.

## Isolation & Concurrency

- Blocking analyze runs the full pipeline in a **subprocess** (`isolated_runner.py`) so SDK clients do not retain state between uploads
- Streaming analyze uses `asyncio.to_thread` per region to keep the event loop responsive
- SSE per-page errors are isolated; remaining regions continue processing

## Security Considerations

- CORS origins configured via `CORS_ORIGINS` (not wildcard in production)
- Upload MIME validated from magic bytes, not client `Content-Type` alone
- Basic PDF/image malware pattern scanning
- API keys never exposed to frontend; health endpoint returns key fingerprint only

## Known Limitations

- Job store is in-memory — jobs lost on process restart
- Multi-page PDFs processed page-by-page; very large documents should use streaming
- Coordinate accuracy depends on vision model quality; skewed scans may need manual review
- Provider rate limits apply (especially Gemini free tier)
