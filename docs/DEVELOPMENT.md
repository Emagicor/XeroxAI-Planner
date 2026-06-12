# Development Guide

## Repository Structure

### Backend (`backend2.0/`)

Organized by concern, not by technical layer alone:

```
backend2.0/
├── main.py                     # FastAPI app factory
├── requirements.txt
├── requirements-dev.txt
├── pytest.ini
├── Dockerfile
└── src/
    ├── api/
    │   ├── routes/             # HTTP endpoints
    │   ├── schemas/            # Pydantic request/response models
    │   └── middleware/         # Global exception handlers
    ├── application/
    │   ├── orchestrators/      # Pipeline coordination
    │   └── use_cases/          # Job store, cross-cutting use cases
    ├── domain/
    │   ├── entities/           # AnalyzeJob, PageResult, RoomResult
    │   └── exceptions.py       # Typed errors (ZeroxError hierarchy)
    ├── engines/
    │   ├── detection/          # Region clipping, bbox refinement
    │   ├── dimensions/         # Parse and sanitize dimensions
    │   ├── area/               # Total area computation
    │   └── validation/         # Response validation rules
    ├── infrastructure/
    │   ├── rasterizer/         # PDF/image rasterization
    │   ├── preprocessing/      # Upscale, contrast, deskew
    │   ├── annotations/        # Overlay rendering
    │   └── exporters/          # CSV/XLSX generation
    ├── pipelines/
    │   ├── ingestion/          # File validation
    │   ├── processing/         # Classification, region expansion
    │   └── extraction/         # Vision analysis orchestration
    ├── providers/
    │   └── vision/             # Gemini, OpenAI, Groq adapters
    ├── prompts/
    │   └── floor_plan.py       # LLM prompt templates
    └── config/
        ├── settings.py         # Pydantic settings
        └── constants.py        # Shared constants
```

**Design rules:**

- `domain/` has zero framework imports
- `api/schemas/` only exist at the HTTP boundary — map to/from domain entities
- New vision providers: implement `VisionProvider`, register in `providers/vision/factory.py`
- Pipeline code never imports FastAPI

### Frontend (`frontend/`)

```
frontend/src/
├── app/                        # App root, routing by mode
├── components/
│   ├── layout/                 # Header, tabs, toasts
│   ├── upload/                 # File input, drop zone
│   ├── analysis/               # Progress panels
│   ├── plan/                   # Annotated images, room tables
│   ├── results/                # Summary, review, exports
│   ├── test-suite/             # Batch QA components
│   └── ui/                     # Shared primitives (Button, Card, Badge)
├── hooks/                      # Stateful logic
├── services/                   # API layer
├── stores/                     # Zustand global state
├── utils/                      # Pure helpers
└── constants/                  # Colors, loading steps, model list
```

Path alias `@/` maps to `src/` (configured in Vite).

---

## Local Workflow

1. Start backend on port 5000
2. Start frontend dev server on port 5173
3. Upload a test plan from `Dataset/` or `test-suite/cases/`
4. Inspect structured logs in the backend terminal (JSON in production)
5. Optional: enable `VISION_PROMPT_LOG_ENABLED` to inspect raw model outputs in `_vision_prompt_logs/`

### Adding a Vision Provider

1. Create `providers/vision/<name>.py` implementing `VisionProvider`
2. Register in `factory.py` `_build_provider()`
3. Add API key and model settings to `settings.py` and `.env.example`
4. Add to frontend `constants/testSuiteModels.js` if selectable in Test Suite

### Modifying Prompts

Edit `prompts/floor_plan.py`. Prompts enforce:

- Strict JSON output (no markdown)
- 0–1000 coordinate scale
- Room coverage checklist
- Dimension source classification

Run the test suite after prompt changes to measure regression.

---

## Testing

### Backend Unit Tests

```bash
cd backend2.0
pip install -r requirements-dev.txt   # first time / after dep changes
pytest                          # all tests
pytest tests/unit/engines/      # specific module
pytest -v --tb=short            # verbose with short tracebacks
```

Test locations:

| Path | Coverage |
|------|----------|
| `tests/unit/engines/` | Detection, validation, dimensions, area |
| `tests/unit/infrastructure/` | Color fidelity, PDF rasterizer, content mask |
| `tests/unit/pipelines/` | Page classifier |
| `tests/unit/providers/` | Vision error handling |

### Frontend Lint

```bash
cd frontend
npm run lint
```

### Integration / Manual QA

Use the **Test Suite** mode in the UI or follow [Test Suite](TEST-SUITE.md) for batch runs.

---

## Code Conventions

### Backend

- Python 3.10+ type hints throughout
- Structured logging via `structlog` — use event names like `pipeline.start`, not free-form strings
- Domain exceptions inherit from `ZeroxError`; never raise bare `Exception` from pipeline code
- Settings accessed via `get_settings()` — do not read `os.environ` directly in business logic

### Frontend

- Functional components with hooks
- API calls isolated in `services/`
- Zustand for cross-component state (API URL, toasts)
- Tailwind utility classes; shared styles in `index.css`

---

## Logging

Development (`APP_ENV=development`): colored console output via `structlog.dev.ConsoleRenderer`

Production: JSON lines suitable for log aggregation.

Key log events:

| Event | Stage |
|-------|-------|
| `pipeline.start` | Job begins |
| `pipeline.ingestion_ok` | File validated |
| `pipeline.unit_start` | Region analysis begins |
| `pipeline.complete` | Job finished |
| `stream.unit_error` | Single region failed in SSE stream |

---

## Build Commands

### Frontend production build

```bash
cd frontend
npm run build     # output: dist/
npm run preview   # serve dist/ locally
```

### Backend production

```bash
uvicorn main:app --host 0.0.0.0 --port 5000 --workers 1
```

Use a single Uvicorn workers unless job store is externalized — the in-memory store is not shared across workers.

---

## Common Development Tasks

| Task | Location |
|------|----------|
| Change upload limits | `settings.py` → `MAX_UPLOAD_MB`, `MAX_PDF_PAGES` |
| Adjust annotation colors | `config/constants.py`, `frontend/src/constants/colors.js` |
| Add export column | `infrastructure/exporters/` |
| Change confidence thresholds | `config/constants.py` |
| Add new page type skip rule | `pipelines/processing/page_classifier.py` |
| Tune region clipping | `settings.py` `detection_clip_*` vars, `engines/detection/region_clipper.py` |
