"""
api/middleware/error_handler.py

Centralised exception → HTTP response mapping.
Routes never catch domain exceptions themselves.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from domain.exceptions import (
    FileValidationError,
    IngestionError,
    SecurityValidationError,
    DocumentValidationError,
    PipelineError,
    ZeroxError,
)


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(FileValidationError)
    @app.exception_handler(SecurityValidationError)
    @app.exception_handler(DocumentValidationError)
    async def ingestion_handler(request: Request, exc: IngestionError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"code": exc.code, "message": exc.message, "details": exc.details},
        )

    @app.exception_handler(PipelineError)
    async def pipeline_handler(request: Request, exc: PipelineError) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"code": exc.code, "message": exc.message, "details": exc.details},
        )

    @app.exception_handler(ZeroxError)
    async def zerox_handler(request: Request, exc: ZeroxError) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"code": exc.code, "message": exc.message, "details": exc.details},
        )

    @app.exception_handler(Exception)
    async def generic_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
        )