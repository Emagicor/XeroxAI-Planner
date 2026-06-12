# Start ZeroxAI backend.
# Usage (from any shell):
#   cd C:\Users\ASUS\Documents\Build91\backend2.0
#   .\start-backend.ps1
#
# Requires: pip install -r requirements.txt (pip install -r requirements-dev.txt for tests).

$ErrorActionPreference = "Stop"
$BackendRoot = $PSScriptRoot
Set-Location $BackendRoot

$Python = "python"
Write-Host "Using Python: $Python" -ForegroundColor Cyan

$env:PYTHONPATH = "src"

# Load .env if present (GEMINI_API_KEY, etc.)
if (Test-Path ".env") {
    Write-Host "Loading .env" -ForegroundColor DarkGray
}

Write-Host "Starting backend at http://localhost:5000" -ForegroundColor Green
& $Python main.py
