# Start ZeroxAI backend with local Grounding DINO (floor plan clipping).
# Usage (from any shell):
#   cd C:\Users\ASUS\Documents\Build91\backend2.0
#   .\start-backend.ps1
#
# Requires: pip install -r requirements.txt in the Python env you use below.

$ErrorActionPreference = "Stop"
$BackendRoot = $PSScriptRoot
Set-Location $BackendRoot

# Prefer GroundingDINO venv (has torch + compatible deps); fall back to python on PATH.
$GdinoPython = "C:\Users\ASUS\Documents\GroundingDINO\GroundingDINO\venv\Scripts\python.exe"
if (Test-Path $GdinoPython) {
    $Python = $GdinoPython
    Write-Host "Using Grounding DINO venv: $Python" -ForegroundColor Cyan
} else {
    $Python = "python"
    Write-Host "Using system Python (ensure torch + requirements are installed)" -ForegroundColor Yellow
}

$env:PYTHONPATH = "src"

# Load .env if present (GROUNDING_DINO_REPO_PATH, GEMINI_API_KEY, etc.)
if (Test-Path ".env") {
    Write-Host "Loading .env" -ForegroundColor DarkGray
}

Write-Host "Starting backend at http://localhost:5000" -ForegroundColor Green
& $Python main.py
