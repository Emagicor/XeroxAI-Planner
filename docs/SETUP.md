# Setup & Deployment

## Requirements

| Dependency | Version | Notes |
|------------|---------|-------|
| Python | 3.10+ (3.11 recommended) | Backend runtime |
| Node.js | 18+ (20 recommended) | Frontend build/dev |
| pip | Latest | Python packages |
| npm | Latest | Frontend packages |

**No Poppler required.** PDF rendering uses PyMuPDF (bundled via pip).

At least one vision provider API key is required:

| Provider | Key source |
|----------|------------|
| Gemini | [Google AI Studio](https://aistudio.google.com) |
| OpenAI | [OpenAI Platform](https://platform.openai.com) |
| Groq | [Groq Console](https://console.groq.com) |

---

## Local Development

### 1. Backend

```bash
cd backend2.0
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `GEMINI_API_KEY` (minimum). See [Configuration](CONFIGURATION.md) for all options.

Start the server:

```bash
# Option A — direct
python main.py

# Option B — Windows script
.\start-backend.ps1

# Option C — uvicorn with reload
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Verify: `curl http://localhost:5000/health`

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The default API URL is `http://localhost:5000`.

### 3. Run Tests (Backend)

```bash
cd backend2.0
pip install -r requirements-dev.txt
pytest
```

---

## Docker Deployment

From the repository root:

```bash
docker compose up --build
```

| Service | Port | Description |
|---------|------|-------------|
| `api` | 5000 | FastAPI backend |
| `web` | 80 | Nginx serving built React app |

**Before starting:** create `backend2.0/`.env` from `.env.example` with valid API keys. Docker Compose loads it via `env_file`.

The frontend image bakes `VITE_API_BASE_URL=http://localhost:5000` at build time. For remote deployments, rebuild with the correct API URL:

```bash
docker compose build web --build-arg VITE_API_BASE_URL=https://api.yourdomain.com
```

### Volumes

- `zerox-tmp` — ephemeral temp storage for PDF rasterization during analyze (required in production)

---

## Production vs Development

| Concern | Development | Production |
|---------|-------------|------------|
| Frontend tabs | Analyze + Test Suite | Analyze only |
| Test Suite storage | `test-suite/` on disk (Vite dev plugin) | Not included in build |
| Swagger `/docs` | On | Off |
| Vision prompt logs | On (optional) | Off |
| Job store | In-memory | In-memory |

### Enable production mode

**Backend** (`backend2.0/.env`):

```env
APP_ENV=production
CORS_ORIGINS=["https://app.yourdomain.com"]
VISION_PROMPT_LOG_ENABLED=false
```

**Frontend** (Docker build or `frontend/.env.production`):

```env
VITE_APP_ENV=production
VITE_FEATURE_TEST_SUITE=false
VITE_API_BASE_URL=https://api.yourdomain.com
```

```bash
docker compose build web --build-arg VITE_API_BASE_URL=https://api.yourdomain.com
docker compose up --build
```

Local dev stays unchanged: `npm run dev` loads `.env.development` with Test Suite enabled.

---

## Storage in Production

### Required (ephemeral)

| What | Where | Purpose |
|------|-------|---------|
| Temp processing | `TEMP_DIR` (Docker: `zerox-tmp` volume → `/tmp/zerox`) | PDF rasterization, image preprocessing during each upload |

No database is required. Each analyze request is self-contained.

### Not required

| What | Notes |
|------|-------|
| Test Suite `test-suite/` folder | Dev-only; not shipped in production nginx build |
| Vision prompt logs `_vision_prompt_logs/` | Disabled when `APP_ENV=production` |
| Persistent job database | Optional — see below |

### Optional (persistent)

The backend **job store is in-memory** (`job_store.py`). Analyze results are returned inline in the API response (annotated images as base64 for typical uploads). The job store only matters if you need:

- `GET /analyze/{job_id}/pages/{n}/annotated` after the initial response
- Export endpoints that reference a past `job_id`

Jobs are **lost on restart** with the current implementation. For production this is usually fine because the frontend keeps the full result in React state after analyze completes.

If you need durable jobs later, replace `job_store.py` with Redis or a database — no other code changes required (noted in the module docstring).

### Frontend browser storage

| Store | Data | Production impact |
|-------|------|-------------------|
| `sessionStorage` | API base URL preference | Cleared when browser tab closes |
| `localStorage` | Theme (light/dark) | Cosmetic only |

No server-side user accounts or uploads are persisted today.

---

## Production Checklist

- [ ] Set `APP_ENV=production` on backend
- [ ] Build frontend with `VITE_APP_ENV=production` and `VITE_FEATURE_TEST_SUITE=false`
- [ ] Configure `CORS_ORIGINS` to your frontend domain(s)
- [ ] Set `VITE_API_BASE_URL` to your public API URL at **build time**
- [ ] Use production-grade API keys with billing enabled
- [ ] Mount or allocate disk for `TEMP_DIR` / `zerox-tmp` volume
- [ ] Set `VISION_PROMPT_LOG_ENABLED=false` (auto-off in production, but explicit is safer)
- [ ] Place a TLS-terminating reverse proxy in front of both services
- [ ] Monitor vision provider quotas and latency
- [ ] Decide if in-memory job store is acceptable (default: yes for analyze-only UI)

---

## Troubleshooting

### Backend won't start

- Confirm Python 3.10+ and all requirements installed
- Check `.env` exists in `backend2.0/` (not project root)
- Verify port 5000 is not in use

### `503` on analyze

- Missing or invalid API key — check `/health` for `configured: false`
- Quota exceeded — try a different model or wait for rate limit reset
- Gemini free tier: prefer `gemini-2.5-flash` over `gemini-3.5-flash`

### Frontend can't reach API

- Confirm `VITE_API_BASE_URL` matches backend URL
- Check CORS: frontend origin must be in `CORS_ORIGINS`
- Rebuild frontend after changing `VITE_*` variables (they are compile-time)

### PDF analysis fails

- Ensure PDF is not password-protected
- Check page count against `MAX_PDF_PAGES` (default 100)
- Very large files may exceed `MAX_UPLOAD_MB` (default 50)

### Windows temp directory

Set an explicit temp path in `.env`:

```
TEMP_DIR=C:\Users\<you>\AppData\Local\Temp\zerox
```
