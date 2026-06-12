# ZeroxAI Documentation

Technical documentation for the Build91 floor plan analysis platform.

## Index

| Document | Audience | Summary |
|----------|----------|---------|
| [Architecture](ARCHITECTURE.md) | Engineers | System design, pipeline stages, data flow |
| [API Reference](API.md) | Integrators | REST endpoints, schemas, status codes |
| [Setup & Deployment](SETUP.md) | DevOps / developers | Installation, Docker, runtime requirements |
| [Configuration](CONFIGURATION.md) | Operators | Environment variables and tuning knobs |
| [Development Guide](DEVELOPMENT.md) | Contributors | Code layout, testing, local workflow |
| [Test Suite](TEST-SUITE.md) | QA / ML engineers | Batch evaluation against ground truth |

## Platform Summary

**ZeroxAI** ingests architectural floor plan documents, runs vision-model extraction per detected plan region, validates and sanitizes room geometry, draws annotated overlays, and exposes results through a React web UI and JSON/CSV/XLSX export APIs.

Two application modes are available in the frontend:

1. **Analyze** — single-document upload with streaming progress for multi-region PDFs
2. **Test Suite** — batch runs against curated cases with accuracy metrics vs. ground truth
