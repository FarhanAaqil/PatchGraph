"""Versioned `/api/v1` router, assembled from one module per area of the API.

Contract: `contracts/openapi.yaml`. Every error uses the envelope `{code, message, field_errors, request_id}`;
access is project-scoped through the `memberships` table; uploads and graph queries are size/depth bounded;
approval decisions are append-only in `plan_decisions` and `audit_logs`.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.app.api import audit, findings, graph, health, imports, jobs, plans
from backend.app.api.common import ContractError, get_request_context, require_role
from backend.app.db.session import get_db

router = APIRouter(prefix="/api/v1")
router.include_router(imports.router)
router.include_router(findings.router)
router.include_router(graph.router)
router.include_router(plans.router)
router.include_router(audit.router)
router.include_router(jobs.router)
router.include_router(health.router)

__all__ = ["ContractError", "get_db", "get_request_context", "require_role", "router"]
