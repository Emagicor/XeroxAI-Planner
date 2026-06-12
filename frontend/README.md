# Frontend

React single-page application for the ZeroxAI floor plan analyzer.

## Stack

- **React 19** with functional components and hooks
- **Vite 8** for dev server and production builds
- **Tailwind CSS 4** for styling
- **Zustand** for lightweight global state

## Scripts

```bash
npm install       # Install dependencies
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # ESLint
```

## Configuration

Create `.env` from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

The API base URL is read at build time. Restart the dev server or rebuild after changes.

## Application Modes

| Mode | Entry | Description |
|------|-------|-------------|
| Analyze | Default tab | Upload a single plan, stream progress, review results |
| Test Suite | Tab switch | Batch QA against ground-truth cases |

## Key Modules

| Path | Role |
|------|------|
| `src/app/App.jsx` | Root layout, mode routing |
| `src/hooks/useFloorPlanAnalysis.js` | Upload, analyze, streaming state |
| `src/hooks/useTestSuiteBatch.js` | Batch run orchestration |
| `src/services/floorPlanPipeline.js` | Chooses blocking vs. streaming API |
| `src/services/analyzeStreamApi.js` | SSE client for `/analyze/stream` |
| `src/stores/apiStore.js` | Configurable API base URL |

## Path Alias

`@/` resolves to `src/` (e.g., `import Header from '@/components/layout/Header'`).

## Production Build

Built via multi-stage Docker:

1. Node build stage — `npm ci && npm run build`
2. Nginx stage — serves `dist/` on port 80

See root [Setup & Deployment](../docs/SETUP.md) for Docker instructions.

## Further Reading

- [Architecture](../docs/ARCHITECTURE.md) — frontend/backend data flow
- [API Reference](../docs/API.md) — endpoints consumed by this app
- [Test Suite](../docs/TEST-SUITE.md) — batch QA workflow
