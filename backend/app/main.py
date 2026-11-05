"""FastAPI application entrypoint for PatchGraph.

Wires request ID middleware, CORS middleware, structured error handlers matching
`{code, message, field_errors, request_id}`, top-level health check, and the `/api/v1` router.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.routes import ContractError, router as api_v1_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="PatchGraph API",
        version="1.0.0",
        description="Software Supply-Chain Intelligence System for Explainable, Constrained Remediation Planning",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def attach_request_id(request: Request, call_next):
        req_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = req_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.exception_handler(ContractError)
    async def handle_contract_error(request: Request, exc: ContractError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.code,
                "message": exc.message,
                "field_errors": exc.field_errors,
                "request_id": req_id,
            },
            headers={"X-Request-Id": req_id},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}")
        field_errors = [
            {
                "field": ".".join(str(p) for p in err.get("loc", [])),
                "issue": err.get("msg", "Validation error"),
                "location": ".".join(str(p) for p in err.get("loc", [])),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=400,
            content={
                "code": "REQUEST_VALIDATION_ERROR",
                "message": "Request parameters or payload failed validation.",
                "field_errors": field_errors,
                "request_id": req_id,
            },
            headers={"X-Request-Id": req_id},
        )

    @app.get("/health")
    async def top_level_health() -> dict:
        return {
            "status": "ok",
            "service": "PatchGraph",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    app.include_router(api_v1_router)
    return app


app = create_app()
