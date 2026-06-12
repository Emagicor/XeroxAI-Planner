# Test Suite

The Test Suite is a built-in QA workflow for batch-evaluating analysis accuracy against ground-truth datasets. It runs in the frontend **Test Suite** tab and persists cases and run history on disk.

## Purpose

- Compare AI output to known room measurements
- Benchmark different vision providers and models
- Track regression across development iterations
- Export accuracy metrics for review

## Directory Layout

```
test-suite/
├── manifest.json           # Case registry (id, label, file names)
├── cases/
│   └── <case-id>/
│       ├── input.png         # Floor plan input (any supported format)
│       └── ground-truth.json # Expected room data
└── test-results/
    ├── results-index.json    # Run history index
    └── run-<timestamp>.json  # Individual run results
```

## Ground Truth Format

Each `ground-truth.json` defines expected rooms and optional metadata:

```json
{
  "label": "Data1",
  "rooms": [
    {
      "name": "Living Room",
      "area_sqft": 320.5,
      "length_ft": 16,
      "width_ft": 20
    }
  ],
  "total_area_sqft": 1850
}
```

See `frontend/public/samples/ground-truth.example.json` for a complete example.

The normalizer in `frontend/src/utils/testSuite/normalize.js` accepts variations in field naming and structure.

## Using the UI

1. Switch to **Test Suite** mode via the tab bar
2. Cases from `manifest.json` load automatically
3. Select cases and choose a vision model from the dropdown
4. Click **Run batch** — each case is analyzed sequentially
5. Review metrics: room match rate, area delta, confidence distribution
6. Browse **Run history** to compare past runs

### Adding Cases

Via UI:

- **Add case** — create an empty case, attach input + ground truth, save
- **Bulk upload** — drop multiple input files; assign ground truth per case

Via filesystem:

1. Create `test-suite/cases/<case-id>/`
2. Add input file and `ground-truth.json`
3. Register in `manifest.json` or reload cases in the UI

## Model Selection

The Test Suite model selector (`constants/testSuiteModels.js`) maps UI options to API overrides:

| UI selection | API form fields |
|--------------|-----------------|
| Gemini 2.5 Flash | `vision_provider=gemini`, `vision_model=gemini-2.5-flash` |
| GPT-4o | `vision_provider=openai`, `vision_model=gpt-4o` |
| Groq Llama Scout | `vision_provider=groq`, `vision_model=meta-llama/...` |

Ensure the corresponding API key is set in `backend2.0/`.env` before running.

## Comparison Logic

**Module:** `frontend/src/utils/testSuite/compare.js`

For each case, the comparator:

1. Normalizes room names (case-insensitive, trimmed)
2. Matches AI rooms to ground-truth rooms by name
3. Computes per-room area delta and dimension delta
4. Aggregates page-level and batch-level metrics

Metrics displayed in `TestSuiteMetrics`:

- Match rate (rooms found vs. expected)
- Mean absolute area error
- Cases with assumed or low-confidence rooms flagged

## Dev Server API

During `npm run dev`, the Vite plugin (`vite.testSuitePlugin.js`) exposes local endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/test-suite/cases` | List cases from manifest |
| POST | `/api/test-suite/cases` | Create case |
| PUT | `/api/test-suite/cases/:id` | Update case files/metadata |
| DELETE | `/api/test-suite/cases/:id` | Remove case |
| GET | `/api/test-suite/results` | List run history |
| GET | `/api/test-suite/results/:runId` | Load run details |
| POST | `/api/test-suite/results` | Persist run results |

These endpoints are dev-only and not available in the production Nginx build.

## Run Results

Each run file (`run-<ISO-timestamp>.json`) contains:

- `runId`, `timestamp`, `modelId`
- Per-case results: AI output, ground truth, comparison metrics
- Batch summary statistics

The results index (`results-index.json`) provides a lightweight list for the run history UI.

## Best Practices

1. **Curate diverse cases** — single/multi region, PDF and image, measured vs. assumed dimensions
2. **Run before merging prompt changes** — compare run history to detect regressions
3. **Use consistent models** — document which provider/model each run used
4. **Keep ground truth accurate** — verify measurements against source plans manually
5. **Enable prompt logging** during investigation — see `VISION_PROMPT_LOG_ENABLED` in [Configuration](CONFIGURATION.md)

## Dataset Reference

The repository includes sample inputs in:

- `test-suite/cases/` — curated QA cases with ground truth
- `Dataset/` — additional floor plan samples (not all have ground truth)

Permanent cases in `manifest.json` are version-controlled. Temporary cases created in the UI can be saved to disk via the case builder.
