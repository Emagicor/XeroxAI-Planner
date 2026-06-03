# Floor Plan Area Calculator — Setup & Run

Phase 1 MVP: stateless, no login. Use **`backend2.0`** (FastAPI, layered) + **`frontend`** (React + Vite).

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| API key | [Google AI Studio](https://aistudio.google.com) (`GEMINI_API_KEY`) and/or OpenAI |

**Windows note:** MIME types are detected from file signatures (PDF/PNG/JPG/WEBP) — no extra native libraries required.

## 1. Backend (`backend2.0`)

```powershell
cd backend2.0
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env — set GEMINI_API_KEY=your_key
python main.py
```

- API: http://localhost:5000  
- Docs (dev): http://localhost:5000/docs  
- Health: http://localhost:5000/health  

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze` | Full document analysis (JSON) |
| POST | `/analyze/stream` | SSE per-page progress |
| POST | `/export/csv` | CSV download (`job_id` + `unit`) |
| POST | `/export/xlsx` | XLSX download |
| GET | `/health` | Liveness |

### Switch vision provider

```env
VISION_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Restart the server after changing `.env`.

### Benchmark two providers

```powershell
$env:BENCHMARK_MODE="true"
$env:VISION_PROVIDER="gemini"
# run sample PDFs, note logs: provider.token_usage

$env:VISION_PROVIDER="openai"
# repeat and compare accuracy + token counts
```

## 2. Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:5173 — `VITE_API_BASE_URL` must point at the backend (default `http://localhost:5000`).

## 3. Production build (single host)

```powershell
# Backend
cd backend2.0
uvicorn main:app --host 0.0.0.0 --port 5000 --workers 2

# Frontend static
cd frontend
npm run build
# Serve dist/ behind nginx/Caddy; proxy /analyze and /export to :5000
```

Or use the included `docker-compose.yml` (from repo root):

```powershell
docker compose up --build
```

Set `GEMINI_API_KEY` in `.env` at repo root before `docker compose up`.

## 4. Acceptance checklist

1. Multi-page PDF → all pages in review table + grand total  
2. Unit selector: sqft → sqm / sq-in / sq-cm (client-side, no re-analyze)  
3. Mixed units in one doc (backend normalizes to feet internally)  
4. Assumed dimensions flagged in table  
5. Ineligible page listed with reason; other pages still show  
6. Edit name/dimensions → area recomputes live  
7. CSV, XLSX (via API or client CSV), clipboard copy  
8. Two providers benchmarked (`BENCHMARK_MODE`)  
9. No persistence — in-memory jobs only for export during session  

## Project layout

```
Build91/
├── backend2.0/          # FastAPI — use this
│   ├── main.py
│   ├── src/
│   │   ├── api/routes/
│   │   ├── application/orchestrators/
│   │   ├── engines/           # deterministic area math
│   │   ├── pipelines/         # ingest → extract → classify
│   │   └── providers/vision/  # gemini | openai
│   └── tests/
├── backend/               # earlier FastAPI port (optional)
├── frontend/              # React + Vite UI
└── docker-compose.yml
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `GEMINI_API_KEY is not set` | Add key to `backend2.0/.env`, restart |
| CORS error | Add your frontend origin to `CORS_ORIGINS` in `.env` |
| `python-magic` install error | Use signature fallback or install libmagic on Windows |
| Export 404 | Analyze first — `job_id` is stored in memory until server restarts |
| PDF fails | Ensure file is not password-protected; max 50 MB / 100 pages |
