# Configuration

All backend settings load from `backend2.0/.env`. Pydantic Settings maps environment variable names (uppercase) to the fields in `src/config/settings.py`.

Frontend settings use Vite env vars prefixed with `VITE_` in `frontend/.env`.

---

## Application

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | JSON array of allowed origins |
| `TEMP_DIR` | `/tmp/zerox` | Temp files for rasterization |

---

## Feature Flags

Resolved at runtime from `APP_ENV` unless explicitly overridden. Check active flags via `GET /health` → `features`.

### Backend

| Variable | Dev default | Prod default | Description |
|----------|-------------|--------------|-------------|
| `FEATURE_OPENAPI` | `true` | `false` | Swagger UI at `/docs` |
| `FEATURE_VISION_PROMPT_LOG` | `true` | `false` | Write raw model outputs to disk |

When `APP_ENV=production`, OpenAPI docs and vision prompt logging are **off** unless you set the flag to `true`.

### Frontend (build-time — rebuild after changes)

| Variable | Dev default | Prod default | Description |
|----------|-------------|--------------|-------------|
| `VITE_APP_ENV` | `development` | `production` | Deployment mode |
| `VITE_FEATURE_TEST_SUITE` | `true` | `false` | Test Suite tab + QA filesystem APIs |
| `VITE_FEATURE_JSON_DOWNLOAD` | `true` | `true` | Download raw analyze JSON in results |

Use `frontend/.env.development` locally and `frontend/.env.production` (or Docker build args) for production builds.

---

## Upload Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_UPLOAD_MB` | `50` | Maximum file size |
| `MAX_PDF_PAGES` | `100` | Maximum PDF pages processed |

---

## PDF & Image Processing

| Variable | Default | Description |
|----------|---------|-------------|
| `PDF_RENDER_DPI` | `300` | PDF rasterization DPI (≥ 216 for CAD) |
| `PDF_RASTER_FORMAT` | `png` | `png` (lossless) or `jpeg` |
| `PDF_RENDER_JPEG_QUALITY` | `98` | JPEG quality when format is jpeg |
| `MIN_IMAGE_DIMENSION` | `1800` | Upscale threshold (px) |
| `CONTRAST_FACTOR` | `1.35` | Contrast boost for small images |
| `CONTRAST_FACTOR_LARGE` | `1.12` | Gentler contrast for high-res images |
| `JPEG_QUALITY` | `98` | Output JPEG quality |
| `VISION_IMAGE_FORMAT` | `png` | Format sent to vision API |

---

## Vision Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `VISION_PROVIDER` | `gemini` | Default provider: `gemini`, `openai`, `groq` |
| `GEMINI_API_KEY` | — | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Gemini model ID |
| `OPENAI_API_KEY` | — | OpenAI key |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model ID |
| `GROQ_API_KEY` | — | Groq key |
| `GROQ_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq model ID |

### Correction Pass

A second vision call can refine weak first-pass results.

| Variable | Default | Description |
|----------|---------|-------------|
| `VISION_CORRECTION_PROVIDER` | `""` | Override provider for pass 2 |
| `VISION_CORRECTION_MODEL` | `""` | Override model for pass 2 |
| `VISION_TWO_PASS` | `false` | Always run extract + correction (2 calls/page) |
| `VISION_CORRECTION_PASS` | `true` | Run pass 2 only when pass 1 is weak |
| `MAX_ANALYSIS_ATTEMPTS` | `1` | Full re-runs on validation failure |
| `GEMINI_TRANSIENT_RETRIES` | `0` | Retries on 503 (not 429 quota) |

Example — Gemini extraction, OpenAI correction:

```env
VISION_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
VISION_CORRECTION_PROVIDER=openai
VISION_CORRECTION_MODEL=gpt-4o
```

### Prompt Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `VISION_PROMPT_LOG_ENABLED` | `true` | Log raw model outputs |
| `VISION_PROMPT_LOG_DIR` | `backend2.0/_vision_prompt_logs` | Log directory |

---

## Region Clipping

Optional padding applied when preparing a full-page region for vision analysis.

| Variable | Default | Description |
|----------|---------|-------------|
| `DETECTION_CLIP_PADDING_RATIO` | `0.035` | Clip region padding ratio |
| `DETECTION_CLIP_PADDING_PX` | `20` | Clip region padding (px) |

---

## Token usage logging

Vision token counts are logged automatically on every analyze request (no flag required).

Logs use the same field names as Gemini `usageMetadata`:

- `promptTokenCount`
- `candidatesTokenCount`
- `thoughtsTokenCount` (Gemini thinking models; derived when the SDK omits it)
- `totalTokenCount`

Per API call: `provider.token_usage`  
Per page (sums each field across passes): `page_analyzer.token_usage`

Note: `google-generativeai` 0.8.x does not expose `thoughtsTokenCount` on its proto; the backend derives it as `totalTokenCount - promptTokenCount - candidatesTokenCount` when needed.

## Benchmarking

| Variable | Default | Description |
|----------|---------|-------------|
| `BENCHMARK_MODE` | `false` | Reserved for extra provider diagnostics |

---

## Frontend API URL

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend API base URL (no trailing slash) |

Rebuild or restart the dev server after changing any `VITE_*` variable.

---

## Per-Request Overrides

Analyze endpoints accept optional form fields that override env defaults for a single request:

| Form field | Maps to |
|------------|---------|
| `vision_provider` | Extraction provider |
| `vision_model` | Extraction model |

Used by the Test Suite model selector to benchmark different providers without restarting the backend.

---

## Reloading Configuration

Settings are cached at startup. To pick up `.env` changes:

- Restart the backend process, or
- Use `reload_settings()` (called automatically in `main.py` on app creation)

Vision provider instances are also cleared on reload.
