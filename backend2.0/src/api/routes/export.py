"""
api/routes/export.py

POST /export/csv   → CSV download
POST /export/xlsx  → XLSX download

FIX vs original:
  - Accepts job_id + unit — fetches AnalyzeJob from in-memory store
  - Exporter logic lives in infrastructure/exporters, not in the route
  - Unit validation via Pydantic pattern constraint
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from api.schemas.analyze import ExportRequestSchema
from application.use_cases.job_store import get_job
from infrastructure.exporters.csv_exporters import export_csv, export_xlsx

router = APIRouter(prefix="/export")


@router.post("/csv")
def export_to_csv(req: ExportRequestSchema):
    job = get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{req.job_id}' not found.")

    content = export_csv(job, req.unit)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=floor_plan_areas.csv"},
    )


@router.post("/xlsx")
def export_to_xlsx(req: ExportRequestSchema):
    job = get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{req.job_id}' not found.")

    content = export_xlsx(job, req.unit)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=floor_plan_areas.xlsx"},
    )