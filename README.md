# Floor Plan AI

AI-powered floor plan dimension evaluation web app for **Build91**. Upload architectural floor plan images (or PDFs), and the system uses **Google Gemini 2.5 Flash** vision to detect rooms, extract or infer dimensions, draw color-coded annotations, and return a structured evaluation with confidence scores and assumptions.

## Project Overview

This application bridges architecture and AI:

- **Upload** a floor plan (JPG, PNG, or PDF)
- **Analyze** with Gemini 2.5 Flash (free tier via Google AI Studio)
- **Detect** all labeled spaces (bedrooms, kitchen, bathrooms, corridors, etc.)
- **Extract** dimensions where annotated; infer where missing using architectural heuristics
- **Annotate** the image with per-room colored polygons, borders, and info cards
- **Review** results in an interactive table with confidence scoring and CSV export

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite, Tailwind CSS |
| Backend | Python Flask + Flask-CORS |
| AI | Google Gemini 2.5 Flash (`google-generativeai`) |
| Image processing | Pillow (PIL) |
| PDF support | pdf2image + Poppler |

```
frontend (port 5173)  →  POST /analyze  →  backend (port 5000)
                                              ↓
                                    preprocess → Gemini (2-pass)
                                              ↓
                                    draw annotations → JSON + base64 image
```

## How It Works

1. **Upload** — User drops or selects a floor plan file in the React UI.
2. **PDF conversion** — If PDF, the first page is rendered to JPEG at 150 DPI via `pdf2image`.
3. **Preprocess** — Image is upscaled (min 1500px), contrast-enhanced, and sharpened before sending to Gemini.
4. **First Gemini pass** — Full architectural prompt with few-shot examples and strict JSON schema (0–1000 coordinate scale).
5. **Second Gemini pass (self-correction)** — Model reviews its own JSON against the image and returns corrected output.
6. **Validate & retry** — Parsed JSON is validated (rooms, bboxes, areas); up to 3 attempts on failure.
7. **Draw annotations** — Colored polygon/bbox overlays and per-room info cards on the **original** image.
8. **Respond** — Structured JSON + base64 annotated JPEG returned to the frontend.

## AI Model

- **Model:** `gemini-2.5-flash`
- **Provider:** Google AI Studio (free tier)
- **API key:** Set `GEMINI_API_KEY` in `backend/.env` — get a free key at [aistudio.google.com](https://aistudio.google.com)
- No fine-tuning required; prompt engineering drives accuracy.

## Prompt Engineering

- **Few-shot examples** for measured vs. assumed rooms
- **Strict JSON schema** — no markdown, no prose in responses
- **Coordinate system** — all `bbox` and `polygon` values are integers 0–1000 (normalized to image edges)
- **Room coverage checklist** — bedrooms, living, kitchen, baths, corridors, balconies, utility, garage, stairs, etc.
- **Dimension rules** — measured (90–100%), derived (70–89%), assumed (40–69%)
- **Two-pass self-correction** — second prompt asks Gemini to fix boundaries, dimensions, and confidence

## Annotation System

- **8-color palette** — consistent between backend overlays and frontend legend/table
- **Polygon-first** — irregular/L-shaped rooms use 6–8 point polygons; rectangles use 4 points
- **Semi-transparent fills** (alpha 45) + thick colored borders
- **Info cards** at room centroids: name, dimensions, area, confidence (color-coded), source tag

## Confidence Scoring

| Source | Confidence range | Meaning |
|--------|------------------|---------|
| `measured` | 90–100% | Dimension text visible on plan |
| `derived` | 70–89% | Calculated from visible dimensions |
| `assumed` | 40–69% | Architectural heuristics applied |

UI colors: green ≥80%, amber 50–79%, red &lt;50%.

## Assumption Engine

When dimensions are not visible, the model applies standard heuristics (documented in each room's `assumptions` array):

- Standard interior door width = **3 ft**
- Standard wall thickness = **6 inches**
- Minimum bedroom = **10 × 10 ft**
- Standard master bedroom = **12 × 14 ft**
- Standard bathroom = **5 × 8 ft**
- Half bath / powder room = **3 × 6 ft**
- Standard kitchen minimum = **8 × 10 ft**
- Standard corridor width = **3.5 ft**
- Relative proportions from adjacent rooms with known dimensions

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- **Poppler** (for PDF support):
  - macOS: `brew install poppler`
  - Linux: `sudo apt-get install poppler-utils`
  - Windows: Download from [poppler releases](http://blog.alivate.com.au/poppler-windows/) and add `bin` to PATH

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create or edit `backend/.env`:

```
GEMINI_API_KEY=your_actual_key_here
```

```bash
python app.py
```

Server runs at `http://localhost:5000` — health check: `GET /health`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
Build91/
├── backend/
│   ├── app.py                 # Flask entry + app factory
│   ├── analyzer.py            # Backward-compatible re-exports
│   ├── config/                # Constants & env settings
│   ├── prompts/               # Gemini prompt templates
│   ├── services/              # Gemini client & analysis orchestration
│   ├── image/                 # Preprocess & PDF conversion
│   ├── annotations/           # Overlay drawing (polygons, room cards)
│   ├── validators/            # Response validation
│   ├── routes/                # API blueprints (/health, /analyze)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── samples/          # Add test floor plan images here
└── README.md
```

## Limitations

- No ground-truth validation against real-world measurements
- Multi-page PDFs use **first page only**
- Very low-resolution images may reduce detection accuracy
- Free tier rate limits (~250 requests/day on Google AI Studio)
- Coordinate accuracy depends on model vision; complex skewed scans may need manual review
- `pdf2image` requires Poppler installed on the host system

## Sample Results

Add annotated screenshots and sample CSV exports to the `/samples` folder after running analysis on test floor plans.

---

Built for the **Build91** internship — architecture, interior design, and visualization technology.
