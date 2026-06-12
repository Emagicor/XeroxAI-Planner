# ZeroxAI Floor Plan Analyzer

**Build91** platform for AI-assisted floor plan analysis. Upload architectural drawings (JPG, PNG, PDF, WEBP); the system detects rooms, extracts or infers dimensions, renders annotated overlays, and returns structured evaluation data with confidence scoring.

## Capabilities

| Feature | Description |
|---------|-------------|
| Multi-format ingestion | PDF (multi-page), PNG, JPG, WEBP — up to 50 MB / 100 PDF pages |
| Region detection | Splits sheets with multiple plans into separate analysis units |
| Vision extraction | Gemini, OpenAI, or Groq — configurable per request |
| Dimension pipeline | Measured, derived, and assumed values with architectural heuristics |
| Annotations | Color-coded polygons, borders, and per-room info cards |
| Export | CSV, XLSX, JSON — with unit conversion (sq ft, sq m, sq in, sq cm) |
| Test suite | Batch QA against ground-truth datasets with run history |

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, Zustand |
| Backend | Python 3.11, FastAPI, Uvicorn, Pydantic |
| Vision | Google Gemini, OpenAI GPT-4o, Groq Llama |
| Imaging | Pillow, PyMuPDF, NumPy |
| Deployment | Docker Compose (API + Nginx) |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- At least one vision provider API key (Gemini recommended)

### Backend

```bash
cd backend2.0
pip install -r requirements.txt
cp .env.example .env   # set GEMINI_API_KEY
python main.py
```

API: `http://localhost:5000` — health: `GET /health`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

UI: `http://localhost:5173`

### Docker

```bash
docker compose up --build
```

Web on port **80**, API on port **5000**.

## Documentation

| Document | Contents |
|----------|----------|
| [Architecture](docs/ARCHITECTURE.md) | Pipeline flow, module layout, design decisions |
| [API Reference](docs/API.md) | Endpoints, request/response schemas, error codes |
| [Setup & Deployment](docs/SETUP.md) | Local dev, Docker, production notes |
| [Configuration](docs/CONFIGURATION.md) | Environment variables and tuning |
| [Development Guide](docs/DEVELOPMENT.md) | Project structure, testing, conventions |
| [Test Suite](docs/TEST-SUITE.md) | Batch QA, ground truth, metrics |

## Project Layout

```
Build91/
├── backend2.0/          # FastAPI analysis service
│   ├── main.py            # Application entry point
│   ├── src/
│   │   ├── api/           # Routes, schemas, middleware
│   │   ├── application/   # Orchestrators, job store
│   │   ├── domain/        # Entities, exceptions
│   │   ├── engines/       # Detection, dimensions, validation
│   │   ├── infrastructure/# Rasterizer, annotations, exporters
│   │   ├── pipelines/     # Ingestion, processing, extraction
│   │   ├── providers/     # Vision provider adapters
│   │   └── prompts/       # LLM prompt templates
│   └── tests/
├── frontend/              # React SPA
│   └── src/
│       ├── app/           # Root application
│       ├── components/    # UI by feature area
│       ├── hooks/         # Analysis and test-suite logic
│       ├── services/      # API clients
│       └── utils/         # Formatting, comparison, export helpers
├── test-suite/            # QA cases, ground truth, run results
└── docs/                  # Platform documentation
```

## License & Attribution

Built for the **Build91** internship — architecture, interior design, and visualization technology.
