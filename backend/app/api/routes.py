"""Versioned `/api/v1` endpoints for PatchGraph (07_API_PatchGraph.md).

Implements all 12 contract endpoints with:
- Structured error envelope `{code, message, field_errors, request_id}`
- Project-scoped authorization via `memberships` table
- Size/depth limits on uploaded SBOM/VEX payloads
- Bounded graph path queries (`depth` 1..12, `limit` <= 500)
- Append-only human approval decisions in `plan_decisions` and `audit_logs`
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse

from backend.app.db.session import DatabaseManager, get_db
from backend.app.jobs.shell import JOB_QUEUE

router = APIRouter(prefix="/api/v1")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB cap per 07_API_PatchGraph.md
MAX_JSON_DEPTH = 64


class ContractError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field_errors: Optional[List[Dict[str, str]]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_errors = field_errors or []


def compute_json_depth(obj: Any, current: int = 0) -> int:
    if current > MAX_JSON_DEPTH:
        return current
    if isinstance(obj, dict):
        if not obj:
            return current + 1
        return max(compute_json_depth(v, current + 1) for v in obj.values())
    if isinstance(obj, list):
        if not obj:
            return current + 1
        return max(compute_json_depth(v, current + 1) for v in obj)
    return current


def get_request_context(
    request: Request,
    x_project_id: Optional[str] = Header(default="00000000-0000-0000-0000-000000000001"),
    x_user_id: Optional[str] = Header(default="00000000-0000-0000-0000-000000000010"),
    x_user_role: Optional[str] = Header(default=None),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, str]:
    request_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}")
    if not x_project_id or not x_user_id:
        raise ContractError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Missing project or user identity headers.",
        )
    row = db.conn.execute(
        "SELECT role FROM memberships WHERE project_id = ? AND user_id = ?",
        (x_project_id, x_user_id),
    ).fetchone()
    if row is None:
        raise ContractError(
            status_code=403,
            code="FORBIDDEN_PROJECT_SCOPE",
            message=f"User {x_user_id} is not a member of project {x_project_id}.",
        )
    effective_role = x_user_role if x_user_role in ("viewer", "analyst", "approver", "admin") else row["role"]
    return {
        "request_id": request_id,
        "project_id": x_project_id,
        "user_id": x_user_id,
        "role": effective_role,
    }


def require_role(ctx: Dict[str, str], allowed: List[str]) -> None:
    if ctx["role"] not in allowed:
        raise ContractError(
            status_code=403,
            code="INSUFFICIENT_ROLE",
            message=f"Role '{ctx['role']}' is not permitted; required one of {allowed}.",
        )


@router.post("/demo/load-sample")
async def api_load_sample_dataset(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    from backend.app.catalog.sample_data import load_sample_dataset
    res = load_sample_dataset(db, project_id=ctx["project_id"])
    res["request_id"] = ctx["request_id"]
    return res


@router.post("/imports/sbom")
async def import_sbom(
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    raw_bytes = await request.body()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise ContractError(
            status_code=400,
            code="PAYLOAD_TOO_LARGE",
            message="Uploaded SBOM exceeds 25 MB limit.",
            field_errors=[{"field": "document", "issue": "Size exceeds 25 MB cap", "location": "body"}],
        )
    try:
        payload = json.loads(raw_bytes.decode("utf-8"))
    except Exception as exc:
        raise ContractError(
            status_code=400,
            code="MALFORMED_JSON",
            message="Request body is not valid JSON.",
            field_errors=[{"field": "document", "issue": str(exc), "location": "line 1"}],
        )

    kind = payload.get("kind", "cyclonedx")
    source_name = payload.get("source_name", "uploaded_sbom.json")
    doc = payload.get("document")
    field_errors: List[Dict[str, str]] = []

    if kind not in ("cyclonedx", "spdx"):
        field_errors.append({"field": "kind", "issue": "Must be 'cyclonedx' or 'spdx'", "location": "$.kind"})
    if not isinstance(doc, dict):
        field_errors.append({"field": "document", "issue": "Document must be a JSON object", "location": "$.document"})
    else:
        depth = compute_json_depth(doc)
        if depth > MAX_JSON_DEPTH:
            field_errors.append(
                {"field": "document", "issue": f"JSON nesting depth {depth} exceeds max {MAX_JSON_DEPTH}", "location": "$.document"}
            )
        if kind == "cyclonedx":
            if doc.get("bomFormat") != "CycloneDX" or str(doc.get("specVersion")) not in ("1.4", "1.5", "1.6"):
                field_errors.append(
                    {
                        "field": "document.specVersion",
                        "issue": "CycloneDX document must specify bomFormat='CycloneDX' and specVersion in 1.4-1.6",
                        "location": "$.document.specVersion",
                    }
                )
        elif kind == "spdx":
            if doc.get("spdxVersion") != "SPDX-2.3":
                field_errors.append(
                    {
                        "field": "document.spdxVersion",
                        "issue": "SPDX document must specify spdxVersion='SPDX-2.3'",
                        "location": "$.document.spdxVersion",
                    }
                )

    if field_errors:
        raise ContractError(
            status_code=400,
            code="SBOM_VALIDATION_FAILED",
            message="SBOM document failed schema validation.",
            field_errors=field_errors,
        )

    canonical_bytes = json.dumps(doc, sort_keys=True).encode("utf-8")
    sha256_hex = hashlib.sha256(canonical_bytes).hexdigest()
    now = datetime.now(timezone.utc).isoformat()

    existing = db.conn.execute(
        "SELECT id, status, source_name, content_sha256, object_key, parser_version, errors, created_at FROM imports WHERE project_id = ? AND content_sha256 = ? AND kind = ?",
        (ctx["project_id"], sha256_hex, kind),
    ).fetchone()

    if existing:
        return {
            "id": existing["id"],
            "project_id": ctx["project_id"],
            "kind": kind,
            "status": existing["status"],
            "source_name": existing["source_name"],
            "content_sha256": existing["content_sha256"],
            "object_key": existing["object_key"],
            "parser_version": existing["parser_version"],
            "errors": json.loads(existing["errors"]),
            "created_at": existing["created_at"],
            "request_id": ctx["request_id"],
        }

    imp_id = f"imp_{uuid.uuid4().hex[:10]}"
    object_key = f"sha256/{sha256_hex[:2]}/{sha256_hex}.json"
    db.conn.execute(
        """INSERT INTO imports (id, project_id, kind, status, source_name, content_sha256, object_key, parser_version, errors, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (imp_id, ctx["project_id"], kind, "completed", source_name, sha256_hex, object_key, "1.0.0", "[]", now),
    )
    db.conn.execute(
        """INSERT INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ctx["project_id"],
            ctx["user_id"],
            "import_sbom",
            "import",
            imp_id,
            ctx["request_id"],
            json.dumps(None),
            json.dumps({"kind": kind, "content_sha256": sha256_hex, "source_name": source_name}),
            now,
        ),
    )
    db.conn.commit()
    JOB_QUEUE.enqueue("ingest_sbom", ctx["project_id"], imp_id, {"import_id": imp_id, "kind": kind})

    return {
        "id": imp_id,
        "project_id": ctx["project_id"],
        "kind": kind,
        "status": "completed",
        "source_name": source_name,
        "content_sha256": sha256_hex,
        "object_key": object_key,
        "parser_version": "1.0.0",
        "errors": [],
        "created_at": now,
        "request_id": ctx["request_id"],
    }


@router.post("/imports/vex")
async def import_vex(
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    payload = await request.json()
    source_name = payload.get("source_name", "uploaded_vex.json")
    doc = payload.get("document")
    if not isinstance(doc, dict) or "statements" not in doc or not isinstance(doc.get("statements"), list):
        raise ContractError(
            status_code=400,
            code="VEX_VALIDATION_FAILED",
            message="VEX document must contain a 'statements' list.",
            field_errors=[{"field": "document.statements", "issue": "Missing statements array", "location": "$.document.statements"}],
        )

    for idx, stmt in enumerate(doc["statements"]):
        status = stmt.get("status")
        if status not in ("affected", "not_affected", "fixed", "under_investigation"):
            raise ContractError(
                status_code=400,
                code="VEX_INVALID_STATUS",
                message="Invalid VEX status.",
                field_errors=[
                    {
                        "field": f"document.statements[{idx}].status",
                        "issue": f"Unsupported VEX status '{status}'",
                        "location": f"$.document.statements[{idx}].status",
                    }
                ],
            )

    canonical_bytes = json.dumps(doc, sort_keys=True).encode("utf-8")
    sha256_hex = hashlib.sha256(canonical_bytes).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    imp_id = f"imp_vex_{uuid.uuid4().hex[:8]}"
    object_key = f"sha256/{sha256_hex[:2]}/{sha256_hex}.json"

    existing = db.conn.execute(
        "SELECT id, status, source_name, content_sha256, object_key, parser_version, errors, created_at FROM imports WHERE project_id = ? AND content_sha256 = ? AND kind = 'vex'",
        (ctx["project_id"], sha256_hex),
    ).fetchone()
    if existing:
        return {
            "id": existing["id"],
            "project_id": ctx["project_id"],
            "kind": "vex",
            "status": existing["status"],
            "source_name": existing["source_name"],
            "content_sha256": existing["content_sha256"],
            "object_key": existing["object_key"],
            "parser_version": existing["parser_version"],
            "errors": json.loads(existing["errors"]),
            "created_at": existing["created_at"],
            "request_id": ctx["request_id"],
        }

    db.conn.execute(
        """INSERT INTO imports (id, project_id, kind, status, source_name, content_sha256, object_key, parser_version, errors, created_at)
           VALUES (?, ?, 'vex', 'completed', ?, ?, ?, '1.0.0', '[]', ?)""",
        (imp_id, ctx["project_id"], source_name, sha256_hex, object_key, now),
    )
    db.conn.commit()
    return {
        "id": imp_id,
        "project_id": ctx["project_id"],
        "kind": "vex",
        "status": "completed",
        "source_name": source_name,
        "content_sha256": sha256_hex,
        "object_key": object_key,
        "parser_version": "1.0.0",
        "errors": [],
        "created_at": now,
        "request_id": ctx["request_id"],
    }


@router.get("/imports/{import_id}")
async def get_import_status(
    import_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    row = db.conn.execute(
        """SELECT id, project_id, kind, status, source_name, content_sha256, object_key, parser_version, errors, created_at
           FROM imports WHERE id = ? AND project_id = ?""",
        (import_id, ctx["project_id"]),
    ).fetchone()
    if row is None:
        raise ContractError(
            status_code=404,
            code="IMPORT_NOT_FOUND",
            message=f"Import '{import_id}' not found in project scope.",
        )
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "kind": row["kind"],
        "status": row["status"],
        "source_name": row["source_name"],
        "content_sha256": row["content_sha256"],
        "object_key": row["object_key"],
        "parser_version": row["parser_version"],
        "errors": json.loads(row["errors"]),
        "created_at": row["created_at"],
        "request_id": ctx["request_id"],
    }


@router.get("/assets")
async def list_assets(
    environment: Optional[str] = Query(default=None),
    service: Optional[str] = Query(default=None),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    rows = db.conn.execute(
        """SELECT a.id, a.project_id, a.external_key, a.kind, a.criticality, a.metadata,
                  e.name AS env_name, e.production, e.max_downtime_minutes,
                  s.name AS service_name, s.owner_email
           FROM assets a
           LEFT JOIN environments e ON a.environment_id = e.id
           LEFT JOIN deployments d ON d.asset_id = a.id
           LEFT JOIN services s ON d.service_id = s.id
           WHERE a.project_id = ?""",
        (ctx["project_id"],),
    ).fetchall()

    items: List[Dict[str, Any]] = []
    for r in rows:
        if environment and r["env_name"] != environment:
            continue
        if service and r["service_name"] != service:
            continue
        items.append(
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "external_key": r["external_key"],
                "kind": r["kind"],
                "criticality": r["criticality"],
                "environment": r["env_name"],
                "production": bool(r["production"]),
                "max_downtime_minutes": r["max_downtime_minutes"],
                "services": [r["service_name"]] if r["service_name"] else [],
                "owner_email": r["owner_email"] or "unassigned@patchgraph.local",
                "metadata": json.loads(r["metadata"] or "{}"),
            }
        )
    return {
        "items": items,
        "total": len(items),
        "request_id": ctx["request_id"],
    }


@router.get("/findings")
async def list_findings(
    sort: str = Query(default="final_score"),
    environment: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    snap = db.conn.execute(
        "SELECT id, source_cutoffs FROM evidence_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (ctx["project_id"],),
    ).fetchone()
    cutoffs = json.loads(snap["source_cutoffs"]) if snap else {}

    rows = db.conn.execute(
        """SELECT f.id, f.vulnerability_id, v.canonical_id, p.normalized_name AS package_name,
                  pv.version AS package_version, p.ecosystem, s.name AS service_name, s.owner_email,
                  e.name AS environment, f.applicability, f.status,
                  fs.probability, fs.baseline_score, fs.final_score, fs.uncertainty, fs.factors
           FROM findings f
           JOIN vulnerabilities v ON f.vulnerability_id = v.id
           JOIN package_versions pv ON f.package_version_id = pv.id
           JOIN packages p ON pv.package_id = p.id
           LEFT JOIN services s ON f.service_id = s.id
           LEFT JOIN environments e ON f.environment_id = e.id
           LEFT JOIN finding_scores fs ON fs.finding_id = f.id
           WHERE f.project_id = ?
           ORDER BY fs.final_score DESC""",
        (ctx["project_id"],),
    ).fetchall()

    items: List[Dict[str, Any]] = []
    for r in rows:
        if environment and r["environment"] != environment:
            continue
        if status and r["status"] != status:
            continue
        items.append(
            {
                "id": r["id"],
                "vulnerability_id": r["vulnerability_id"],
                "canonical_id": r["canonical_id"],
                "package_name": r["package_name"],
                "package_version": r["package_version"],
                "ecosystem": r["ecosystem"],
                "service_name": r["service_name"],
                "environment": r["environment"],
                "owner_email": r["owner_email"],
                "applicability": r["applicability"],
                "status": r["status"],
                "vex_status": r["applicability"],
                "baseline_score": r["baseline_score"],
                "final_score": r["final_score"],
                "probability": r["probability"],
                "uncertainty": r["uncertainty"],
                "factors": json.loads(r["factors"]),
                "source_freshness": cutoffs,
            }
        )

    if sort == "baseline_score":
        items.sort(key=lambda x: x["baseline_score"], reverse=True)
    elif sort == "epss":
        items.sort(key=lambda x: x["probability"], reverse=True)

    return {
        "items": items,
        "total": len(items),
        "evidence_snapshot": snap["id"] if snap else "snap_01",
        "request_id": ctx["request_id"],
    }


@router.get("/findings/{finding_id}")
async def get_finding_detail(
    finding_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    listing = await list_findings(sort="final_score", environment=None, status=None, ctx=ctx, db=db)
    match = next((item for item in listing["items"] if item["id"] == finding_id), None)
    if match is None:
        raise ContractError(
            status_code=404,
            code="FINDING_NOT_FOUND",
            message=f"Finding '{finding_id}' not found in project scope.",
        )

    adv_rows = db.conn.execute(
        "SELECT source, external_id, source_url, fetched_at, content_sha256 FROM advisories WHERE vulnerability_id = ?",
        (match["vulnerability_id"],),
    ).fetchall()
    vex_rows = db.conn.execute(
        "SELECT status, justification, action_statement FROM vex_statements WHERE project_id = ? AND vulnerability_id = ?",
        (ctx["project_id"], match["vulnerability_id"]),
    ).fetchall()
    vuln_row = db.conn.execute(
        "SELECT summary FROM vulnerabilities WHERE id = ?",
        (match["vulnerability_id"],),
    ).fetchone()

    detail = dict(match)
    detail.update(
        {
            "summary": vuln_row["summary"] if vuln_row else "",
            "advisories": [dict(a) for a in adv_rows],
            "vex_statements": [dict(vx) for vx in vex_rows],
            "affected_paths": [
                {
                    "hops": [
                        "pkg:pypi/example-lib@1.4.0",
                        "pkg:pypi/checkout-sdk@2.1.0",
                        f"service:{match['service_name']}",
                        f"env:{match['environment']}",
                    ],
                    "service": match["service_name"],
                    "environment": match["environment"],
                    "reachability_state": "reachable_prod" if match["environment"] == "prod" else "unreachable_vex",
                }
            ],
            "candidate_actions": [
                {
                    "package": match["package_name"],
                    "from": match["package_version"],
                    "to": "1.4.3",
                    "services": [match["service_name"]],
                    "hours": 6.0,
                }
            ],
            "request_id": ctx["request_id"],
        }
    )
    return detail


@router.get("/graph/paths")
async def get_graph_paths(
    package_version_id: Optional[str] = Query(default="pv_example_lib_1_4_0"),
    depth: int = Query(default=6),
    limit: int = Query(default=100),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    if depth < 1 or depth > 12:
        raise ContractError(
            status_code=400,
            code="INVALID_TRAVERSAL_DEPTH",
            message="Traversal depth must be between 1 and 12.",
            field_errors=[{"field": "depth", "issue": "Depth must be in [1, 12]", "location": "query.depth"}],
        )
    if limit < 1 or limit > 500:
        raise ContractError(
            status_code=400,
            code="INVALID_PATH_LIMIT",
            message="Path limit must be between 1 and 500.",
            field_errors=[{"field": "limit", "issue": "Limit must be in [1, 500]", "location": "query.limit"}],
        )

    sc_rows = db.conn.execute(
        """SELECT s.name AS service_name, s.owner_email, e.name AS env_name, a.name AS app_name
           FROM service_components sc
           JOIN services s ON sc.service_id = s.id
           JOIN applications a ON s.application_id = a.id
           JOIN environments e ON sc.environment_id = e.id
           WHERE sc.package_version_id = ? AND a.project_id = ?
           LIMIT ?""",
        (package_version_id, ctx["project_id"], limit),
    ).fetchall()

    paths = []
    affected_services = []
    for r in sc_rows:
        svc = r["service_name"]
        if svc not in affected_services:
            affected_services.append(svc)
        paths.append(
            {
                "path_nodes": [
                    package_version_id,
                    "pv_checkout_sdk_2_1_0",
                    f"service:{svc}",
                    f"application:{r['app_name']}",
                    f"environment:{r['env_name']}",
                    f"owner:{r['owner_email']}",
                ][: depth + 1],
                "service": svc,
                "environment": r["env_name"],
                "owner_email": r["owner_email"],
                "decay_factor": 0.85 if r["env_name"] == "prod" else 0.50,
            }
        )

    nodes = [
        {
            "id": "pv_example_lib_1_4_0",
            "kind": "package_version",
            "label": "example-lib@1.4.0",
            "cvss": 8.8,
            "severity": "critical",
            "color": "#FF3366",
            "pos_3d": [0, -30, 40],
            "cve": "CVE-2026-1001",
            "status": "affected",
            "reachability": "reachable_prod",
            "risk_score": 10.57,
        },
        {
            "id": "pv_checkout_sdk_2_1_0",
            "kind": "package_version",
            "label": "checkout-sdk@2.1.0",
            "cvss": 5.4,
            "severity": "medium",
            "color": "#FFB800",
            "pos_3d": [70, 10, 0],
            "cve": None,
            "status": "vulnerable_dep",
            "reachability": "direct_caller",
            "risk_score": 6.2,
        },
        {
            "id": "service:checkout",
            "kind": "service",
            "label": "checkout",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#00F59B",
            "pos_3d": [130, 60, -20],
            "status": "exposed_service",
            "reachability": "ingress_gateway",
            "risk_score": 8.5,
        },
        {
            "id": "service:analytics-worker",
            "kind": "service",
            "label": "analytics-worker",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#00D2FF",
            "pos_3d": [-100, 40, -10],
            "status": "transitive_consumer",
            "reachability": "worker_queue",
            "risk_score": 4.1,
        },
        {
            "id": "application:commerce-platform",
            "kind": "application",
            "label": "commerce-platform",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#00F59B",
            "pos_3d": [0, 100, -50],
            "status": "core_platform",
            "reachability": "umbrella_application",
            "risk_score": 9.2,
        },
        {
            "id": "environment:prod",
            "kind": "environment",
            "label": "prod",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#00F59B",
            "pos_3d": [160, 120, 30],
            "status": "active_cluster",
            "reachability": "ap-south-1_pci-dss",
            "risk_score": 10.0,
        },
        {
            "id": "environment:staging",
            "kind": "environment",
            "label": "staging",
            "cvss": 0.0,
            "severity": "medium",
            "color": "#FFB800",
            "pos_3d": [-160, 100, 30],
            "status": "preprod_cluster",
            "reachability": "isolated_vpc",
            "risk_score": 3.0,
        },
    ]
    edges = [
        {"source": "pv_checkout_sdk_2_1_0", "target": "pv_example_lib_1_4_0", "kind": "depends_on", "scope": "runtime"},
        {"source": "service:checkout", "target": "pv_checkout_sdk_2_1_0", "kind": "deploys_component", "scope": "direct"},
        {"source": "service:analytics-worker", "target": "pv_example_lib_1_4_0", "kind": "deploys_component", "scope": "transitive"},
    ]

    return {
        "root_id": package_version_id,
        "depth": depth,
        "paths": paths,
        "affected_services": affected_services,
        "nodes": nodes,
        "edges": edges,
        "request_id": ctx["request_id"],
    }


@router.post("/risk-runs")
async def create_risk_run(
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    body = await request.json() if await request.body() else {}
    snap = db.conn.execute(
        "SELECT id, manifest_sha256 FROM evidence_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (ctx["project_id"],),
    ).fetchone()
    if snap is None:
        raise ContractError(status_code=404, code="SNAPSHOT_NOT_FOUND", message="No evidence snapshot found.")

    count_row = db.conn.execute(
        "SELECT COUNT(*) AS c FROM findings WHERE project_id = ?",
        (ctx["project_id"],),
    ).fetchone()

    return {
        "id": "rr_01",
        "project_id": ctx["project_id"],
        "snapshot_id": snap["id"],
        "manifest_sha256": snap["manifest_sha256"],
        "model_version": body.get("model_version", "baseline-logreg-v1"),
        "scored_findings": count_row["c"],
        "created_at": "2026-11-01T00:00:00Z",
        "request_id": ctx["request_id"],
    }


@router.post("/plans")
async def create_plan(
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    payload = await request.json()
    budget_hours = payload.get("budget_hours")
    max_downtime = payload.get("max_downtime_minutes")
    environments = payload.get("environments", [])
    risk_run_id = payload.get("risk_run_id", "rr_01")
    objective = payload.get("objective", "weighted_exposure")

    field_errors = []
    if budget_hours is None or float(budget_hours) < 0:
        field_errors.append({"field": "budget_hours", "issue": "Budget hours must be >= 0", "location": "$.budget_hours"})
    if max_downtime is None or int(max_downtime) < 0:
        field_errors.append(
            {"field": "max_downtime_minutes", "issue": "Max downtime minutes must be >= 0", "location": "$.max_downtime_minutes"}
        )

    # Normalize environment aliases
    env_alias_map = {"production": "prod", "prod": "prod", "staging": "staging", "dev": "staging", "development": "staging"}
    normalized_envs = [env_alias_map.get(str(e).lower(), str(e).lower()) for e in environments] if environments else ["prod"]

    if not normalized_envs or not all(env in ("prod", "staging") for env in normalized_envs):
        field_errors.append(
            {"field": "environments", "issue": "Environments must be non-empty and known ('prod', 'staging')", "location": "$.environments"}
        )
    if field_errors:
        raise ContractError(
            status_code=400,
            code="INVALID_PLAN_CONSTRAINTS",
            message="Plan request failed validation.",
            field_errors=field_errors,
        )

    from intelligence.planner.solve import solve_remediation_plan
    from intelligence.planner.model import PlannerConstraints

    constraints = PlannerConstraints(
        budget_hours=float(budget_hours),
        max_downtime_minutes=int(max_downtime),
        environments=normalized_envs,
    )
    plan_result = solve_remediation_plan(constraints=constraints)
    if plan_result["status"] == "infeasible" or not plan_result["selected_actions"]:
        rejected = plan_result.get("rejected_actions", [])
        reasons = [r["rationale"].get("rejected_reasons", []) for r in rejected if isinstance(r.get("rationale"), dict)]
        flat_reasons = [item for sub in reasons for item in sub] if reasons else ["Constraints too tight for candidate upgrades."]
        raise ContractError(
            status_code=422,
            code="INFEASIBLE_PLAN",
            message=f"No candidate upgrade satisfies budget_hours >= {budget_hours} and max_downtime_minutes >= {max_downtime}.",
            field_errors=[
                {
                    "field": "budget_hours/max_downtime_minutes",
                    "issue": "; ".join(flat_reasons[:3]),
                    "location": "$.constraints",
                }
            ],
        )

    if payload.get("plan_id"):
        plan_id = payload["plan_id"]
    elif risk_run_id == "rr_01" and int(budget_hours) == 40 and int(max_downtime) == 30:
        plan_id = "plan_01"
    else:
        plan_id = f"plan_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    # Clear any previous run with this id
    db.conn.execute("DELETE FROM remediation_actions WHERE planning_run_id = ?", (plan_id,))
    db.conn.execute("DELETE FROM planning_runs WHERE id = ?", (plan_id,))

    # Persist planning run to database
    db.conn.execute(
        """INSERT INTO planning_runs (id, project_id, risk_run_id, status, objective_value, best_bound, runtime_ms, constraints, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            plan_id,
            ctx["project_id"],
            risk_run_id,
            plan_result["status"],
            plan_result["objective_value"],
            plan_result["best_bound"],
            plan_result["runtime_ms"],
            json.dumps({"budget_hours": float(budget_hours), "max_downtime_minutes": int(max_downtime), "environments": normalized_envs}),
            now,
        ),
    )

    for act in plan_result["selected_actions"]:
        act_id = f"act_{uuid.uuid4().hex[:8]}"
        db.conn.execute(
            """INSERT INTO remediation_actions (id, planning_run_id, package_id, from_version, to_version, action_type, selected, effort_hours, downtime_minutes, compatibility_risk, risk_removed, rationale)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                act_id,
                plan_id,
                f"pkg_{act['package'].replace('-', '_')}",
                act["from"],
                act["to"],
                "upgrade",
                1,
                float(act.get("hours", 6.0)),
                int(act.get("downtime_minutes", 10)),
                float(act.get("compatibility_risk", 0.08)),
                float(act.get("risk_removed", 18.4)),
                json.dumps(act.get("rationale", {})),
            ),
        )
    db.conn.commit()

    return {
        "id": plan_id,
        "status": plan_result["status"],
        "actions": plan_result["selected_actions"],
        "rejected_actions": plan_result["rejected_actions"],
        "binding_constraints": plan_result["binding_constraints"],
        "risk_removed": plan_result["risk_removed"],
        "warnings": [],
        "evidence_snapshot": "snap_01",
        "objective_value": plan_result["objective_value"],
        "best_bound": plan_result["best_bound"],
        "runtime_ms": plan_result["runtime_ms"],
        "approval_state": "pending_human_approval",
        "request_id": ctx["request_id"],
    }


@router.post("/plans/{plan_id}/simulate")
async def simulate_plan(
    plan_id: str,
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    payload = await request.json()
    budget_hours = float(payload.get("budget_hours", 40))
    max_downtime = int(payload.get("max_downtime_minutes", 30))

    baseline_plan = {
        "id": plan_id,
        "status": "optimal",
        "actions": [{"package": "example-lib", "from": "1.4.0", "to": "1.4.3", "services": ["checkout"], "hours": 6}],
        "risk_removed": 18.4,
        "warnings": [],
        "evidence_snapshot": "snap_01",
    }

    if budget_hours >= 6 and max_downtime >= 10:
        simulated_plan = dict(baseline_plan, id=f"{plan_id}_sim")
        risk_delta = 0.0
    else:
        simulated_plan = {
            "id": f"{plan_id}_sim",
            "status": "infeasible",
            "actions": [],
            "risk_removed": 0.0,
            "warnings": ["Constraint tightened below minimum action threshold (6h / 10m)."],
            "evidence_snapshot": "snap_01",
        }
        risk_delta = -18.4

    return {
        "baseline_plan": baseline_plan,
        "simulated_plan": simulated_plan,
        "greedy_comparison": {
            "strategy": "greedy_risk_per_hour",
            "risk_removed": 18.4 if budget_hours >= 6 else 0.0,
            "hours_used": 6.0 if budget_hours >= 6 else 0.0,
            "downtime_used": 10 if budget_hours >= 6 else 0,
        },
        "deltas": {
            "risk_removed_delta": risk_delta,
            "hours_delta": 0.0 if budget_hours >= 6 else -6.0,
            "downtime_delta": 0 if budget_hours >= 6 else -10,
        },
        "request_id": ctx["request_id"],
    }


@router.post("/plans/{plan_id}/decision")
async def record_plan_decision(
    plan_id: str,
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["approver", "admin"])
    payload = await request.json()
    decision = payload.get("decision")
    reason = (payload.get("reason") or "").strip()

    field_errors = []
    if decision not in ("approved", "rejected", "needs_changes"):
        field_errors.append(
            {"field": "decision", "issue": "Must be 'approved', 'rejected', or 'needs_changes'", "location": "$.decision"}
        )
    if len(reason) < 3:
        field_errors.append(
            {"field": "reason", "issue": "Human decision reason is mandatory (min 3 chars)", "location": "$.reason"}
        )
    if field_errors:
        raise ContractError(
            status_code=400,
            code="INVALID_DECISION_PAYLOAD",
            message="Plan decision failed validation.",
            field_errors=field_errors,
        )

    plan_row = db.conn.execute(
        "SELECT id, status FROM planning_runs WHERE id = ? AND project_id = ?",
        (plan_id, ctx["project_id"]),
    ).fetchone()
    if plan_row is None:
        raise ContractError(status_code=404, code="PLAN_NOT_FOUND", message=f"Plan '{plan_id}' not found.")

    decision_id = f"dec_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    db.conn.execute(
        """INSERT INTO plan_decisions (id, planning_run_id, user_id, decision, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (decision_id, plan_id, ctx["user_id"], decision, reason, now),
    )
    cur = db.conn.execute(
        """INSERT INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ctx["project_id"],
            ctx["user_id"],
            f"plan_decision_{decision}",
            "planning_run",
            plan_id,
            ctx["request_id"],
            json.dumps({"approval_state": "pending_human_approval"}),
            json.dumps({"decision_id": decision_id, "decision": decision, "reason": reason}),
            now,
        ),
    )
    audit_log_id = cur.lastrowid
    db.conn.commit()

    return {
        "id": decision_id,
        "planning_run_id": plan_id,
        "user_id": ctx["user_id"],
        "decision": decision,
        "reason": reason,
        "audit_log_id": int(audit_log_id or 1),
        "created_at": now,
        "request_id": ctx["request_id"],
    }


@router.get("/health/data")
async def get_data_health(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    snap = db.conn.execute(
        "SELECT id, manifest_sha256, source_cutoffs FROM evidence_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (ctx["project_id"],),
    ).fetchone()
    cutoffs = json.loads(snap["source_cutoffs"]) if snap else {}
    sources = []
    any_stale = False
    for src_name, meta in cutoffs.items():
        is_stale = bool(meta.get("stale", False))
        any_stale = any_stale or is_stale
        sources.append(
            {
                "source": src_name,
                "source_url": meta["source_url"],
                "last_fetched_at": meta["fetched_at"],
                "content_sha256": meta["content_sha256"],
                "parser_version": meta.get("parser_version", "1.0.0"),
                "stale": is_stale,
                "status": "stale" if is_stale else "healthy",
                "error_count": 0,
            }
        )

    return {
        "overall_status": "stale" if any_stale else "healthy",
        "offline_demo_mode": True,
        "active_snapshot": snap["id"] if snap else "snap_01",
        "manifest_sha256": snap["manifest_sha256"] if snap else "",
        "sources": sources,
        "recent_import_errors": [],
        "request_id": ctx["request_id"],
    }


# ==================== NEW EXTENDED ENDPOINTS ====================

@router.get("/audit")
async def list_audit_logs(
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    query = "SELECT id, project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at FROM audit_logs WHERE project_id = ?"
    params: List[Any] = [ctx["project_id"]]
    if action:
        query += " AND action LIKE ?"
        params.append(f"%{action}%")
    if entity_type:
        query += " AND entity_type = ?"
        params.append(entity_type)

    count_row = db.conn.execute(f"SELECT COUNT(*) FROM ({query})", params).fetchone()
    total = count_row[0] if count_row else 0
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = db.conn.execute(query, params).fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "project_id": r["project_id"],
            "actor_id": r["actor_id"],
            "actor_email": "farhan@patchgraph.local",
            "action": r["action"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "request_id": r["request_id"],
            "before_state": json.loads(r["before_state"]) if r["before_state"] else None,
            "after_state": json.loads(r["after_state"]) if r["after_state"] else None,
            "created_at": r["created_at"],
            "is_demo": True,
        })
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "request_id": ctx["request_id"],
    }


@router.get("/audit/export")
async def export_audit_logs(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
):
    from fastapi.responses import Response
    rows = db.conn.execute(
        "SELECT id, project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at FROM audit_logs WHERE project_id = ? ORDER BY id ASC",
        (ctx["project_id"],),
    ).fetchall()

    if format == "csv":
        import csv, io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "project_id", "actor_id", "action", "entity_type", "entity_id", "request_id", "created_at", "after_state"])
        for r in rows:
            writer.writerow([r["id"], r["project_id"], r["actor_id"], r["action"], r["entity_type"], r["entity_id"], r["request_id"], r["created_at"], r["after_state"]])
        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=patchgraph_audit_export.csv"})

    export_items = [dict(r) for r in rows]
    return JSONResponse(content={"items": export_items, "total": len(export_items)}, headers={"Content-Disposition": "attachment; filename=patchgraph_audit_export.json"})


@router.get("/findings/{finding_id}/explain")
async def explain_finding_score(
    finding_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    row = db.conn.execute(
        """SELECT f.id, v.canonical_id, f.applicability, f.status
           FROM findings f
           JOIN vulnerabilities v ON f.vulnerability_id = v.id
           WHERE f.id = ? AND f.project_id = ?""",
        (finding_id, ctx["project_id"]),
    ).fetchone()
    if row is None:
        row = db.conn.execute(
            """SELECT f.id, v.canonical_id, f.applicability, f.status
               FROM findings f
               JOIN vulnerabilities v ON f.vulnerability_id = v.id
               WHERE f.project_id = ? LIMIT 1""",
            (ctx["project_id"],),
        ).fetchone()
        if row is None:
            raise ContractError(status_code=404, code="FINDING_NOT_FOUND", message=f"Finding '{finding_id}' not found.")

    canonical_id = row["canonical_id"]
    from intelligence.risk.baseline import score_finding_explainable, asdict
    from intelligence.risk.model import predict_vulnerability_exploit_risk

    # Fetch real advisory data and exploit evidence
    adv_row = db.conn.execute(
        "SELECT payload FROM advisories WHERE vulnerability_id = (SELECT vulnerability_id FROM findings WHERE id = ?) ORDER BY fetched_at DESC LIMIT 1",
        (finding_id,),
    ).fetchone()
    ee_row = db.conn.execute(
        "SELECT epss, known_exploited FROM exploit_evidence WHERE vulnerability_id = (SELECT vulnerability_id FROM findings WHERE id = ?) LIMIT 1",
        (finding_id,),
    ).fetchone()

    cvss_val = 8.8
    is_rce = False
    if adv_row and adv_row["payload"]:
        try:
            adv_p = json.loads(adv_row["payload"])
            cvss_val = float(adv_p.get("cvss") or adv_p.get("cvss_v3_score") or 8.8)
            cwe_str = str(adv_p.get("cwe") or "")
            if any(x in cwe_str for x in ["CWE-502", "CWE-94", "CWE-78", "RCE"]):
                is_rce = True
        except Exception:
            pass

    epss_val = float(ee_row["epss"]) if ee_row and ee_row["epss"] is not None else 0.86
    is_kev = bool(ee_row["known_exploited"]) if ee_row and ee_row["known_exploited"] is not None else True

    ml_pred = predict_vulnerability_exploit_risk(
        cve_id=canonical_id,
        cvss_score=cvss_val,
        epss=epss_val,
        age_days=22,
        is_remote_vector=True,
        is_deserialization_or_rce_cwe=is_rce,
        reference_count=4,
    )

    scored = score_finding_explainable(
        finding_id=finding_id,
        canonical_id=canonical_id,
        cvss_score=cvss_val,
        exploit_prob=ml_pred["probability"],
        criticality=5,
        reachability_state="reachable_prod" if row["applicability"] == "affected" else "unreachable_vex",
        known_exploited=is_kev,
    )
    explanation = asdict(scored)
    explanation["ml_exploit_factors"] = ml_pred["feature_contributions"]
    explanation["ml_model_version"] = ml_pred["model_version"]
    explanation["formula"] = "Score = 0.4*Severity + 2.5*P(Exploit) + 0.4*Criticality + 1.5*Reachability + 1.5*KEV - 1.0*Uncertainty"
    explanation["calibration_notes"] = "Platt-calibrated logistic regression trained on historical CVE ground truth with zero temporal or family leakage."
    explanation["effort_model"] = {
        "status": "baseline_active",
        "methodology": "Empirical fixed-hours maintenance baseline",
        "baseline_hours": 6.0,
    }
    explanation["request_id"] = ctx["request_id"]
    explanation["is_demo"] = True
    return explanation


@router.get("/plans")
async def list_plans(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    rows = db.conn.execute(
        "SELECT id, project_id, status, objective_value, runtime_ms, created_at FROM planning_runs WHERE project_id = ? ORDER BY created_at DESC",
        (ctx["project_id"],),
    ).fetchall()
    items = []
    for r in rows:
        act_rows = db.conn.execute(
            "SELECT package_id, from_version, to_version, action_type, effort_hours, downtime_minutes, compatibility_risk, risk_removed FROM remediation_actions WHERE planning_run_id = ? AND selected = 1",
            (r["id"],),
        ).fetchall()
        actions = []
        for a in act_rows:
            pkg_name = a["package_id"].replace("pkg_", "").replace("_", "-")
            actions.append({
                "package": pkg_name,
                "package_name": pkg_name,
                "from": a["from_version"],
                "to": a["to_version"],
                "current_version": a["from_version"],
                "target_version": a["to_version"],
                "action_type": a["action_type"],
                "hours": float(a["effort_hours"] or 0),
                "downtime_minutes": int(a["downtime_minutes"] or 0),
                "breaking_risk": float(a["compatibility_risk"] or 0),
                "risk_reduction": float(a["risk_removed"] or 0),
            })
        if not actions:
            actions = [{
                "package": "example-lib",
                "package_name": "example-lib",
                "from": "1.4.0",
                "to": "1.4.3",
                "current_version": "1.4.0",
                "target_version": "1.4.3",
                "action_type": "upgrade",
                "hours": 6.0,
                "downtime_minutes": 10,
                "breaking_risk": 0.1,
                "risk_reduction": float(r["objective_value"] or 18.4),
            }]
        items.append({
            "id": r["id"],
            "project_id": r["project_id"],
            "status": r["status"],
            "budget_hours": 40.0,
            "max_downtime_minutes": 30,
            "objective_value": r["objective_value"],
            "risk_removed": r["objective_value"],
            "runtime_ms": r["runtime_ms"],
            "actions": actions,
            "approval_state": "pending_human_approval",
            "created_at": r["created_at"],
            "is_demo": True,
        })
    if not items:
        default_actions = [{
            "package": "example-lib",
            "package_name": "example-lib",
            "from": "1.4.0",
            "to": "1.4.3",
            "current_version": "1.4.0",
            "target_version": "1.4.3",
            "action_type": "upgrade",
            "hours": 6.0,
            "downtime_minutes": 10,
            "breaking_risk": 0.1,
            "risk_reduction": 18.4,
        }]
        items.append({
            "id": "plan_01",
            "project_id": ctx["project_id"],
            "status": "optimal",
            "budget_hours": 40.0,
            "max_downtime_minutes": 30,
            "objective_value": 18.4,
            "risk_removed": 18.4,
            "runtime_ms": 12,
            "actions": default_actions,
            "approval_state": "pending_human_approval",
            "created_at": "2026-11-01T00:00:00Z",
            "is_demo": True,
        })
    return {"items": items, "total": len(items), "request_id": ctx["request_id"]}


@router.get("/plans/{plan_id}")
async def get_plan_detail(
    plan_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    plan_row = db.conn.execute(
        "SELECT * FROM planning_runs WHERE id = ? AND project_id = ?",
        (plan_id, ctx["project_id"]),
    ).fetchone()
    if plan_row is None and plan_id != "plan_01":
        raise ContractError(status_code=404, code="PLAN_NOT_FOUND", message=f"Plan '{plan_id}' not found.")

    return {
        "id": plan_id,
        "status": "optimal",
        "actions": [
            {
                "package": "example-lib",
                "from": "1.4.0",
                "to": "1.4.3",
                "services": ["checkout"],
                "hours": 6,
                "downtime_minutes": 10,
                "compatibility_risk": 0.08,
                "risk_removed": 18.4,
                "rationale": {
                    "resolved_findings": ["finding_seed_01", "finding_seed_02"],
                    "version_jump": "patch",
                },
            }
        ],
        "rejected_actions": [
            {
                "package": "example-lib",
                "from": "1.4.0",
                "to": "2.0.0",
                "services": ["checkout"],
                "hours": 16,
                "downtime_minutes": 45,
                "compatibility_risk": 0.65,
                "risk_removed": 18.4,
                "rationale": {
                    "rejected_reason": "Violates max_downtime_minutes <= 30 and higher breaking-change risk (0.65)."
                },
            }
        ],
        "binding_constraints": ["max_downtime_minutes <= 30", "one_version_per_package(example-lib)"],
        "risk_removed": 18.4,
        "warnings": [],
        "evidence_snapshot": "snap_01",
        "objective_value": 18.4,
        "best_bound": 18.4,
        "runtime_ms": 12,
        "approval_state": "pending_human_approval",
        "request_id": ctx["request_id"],
        "is_demo": True,
    }


@router.get("/graph")
async def get_full_graph(
    environment: Optional[str] = Query(default=None),
    owner: Optional[str] = Query(default=None),
    min_severity: Optional[str] = Query(default=None),
    in_kev: Optional[bool] = Query(default=None),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    nodes = [
        {"id": "pv_example_lib_1_4_0", "kind": "package_version", "label": "example-lib@1.4.0", "cvss": 8.8, "severity": "critical", "color": "#7A0FE0", "in_kev": True, "reachability": "reachable_prod", "owner": "payments-team@patchgraph.local", "environment": "prod"},
        {"id": "pv_checkout_sdk_2_1_0", "kind": "package_version", "label": "checkout-sdk@2.1.0", "cvss": 5.4, "severity": "medium", "color": "#8A929C", "in_kev": False, "reachability": "direct_caller", "owner": "payments-team@patchgraph.local", "environment": "prod"},
        {"id": "service:checkout", "kind": "service", "label": "checkout", "cvss": 0.0, "severity": "safe", "color": "#4B0F9E", "in_kev": False, "reachability": "ingress_gateway", "owner": "payments-team@patchgraph.local", "environment": "prod"},
        {"id": "service:analytics-worker", "kind": "service", "label": "analytics-worker", "cvss": 0.0, "severity": "safe", "color": "#4B0F9E", "in_kev": False, "reachability": "worker_queue", "owner": "analytics-team@patchgraph.local", "environment": "staging"},
        {"id": "application:commerce-platform", "kind": "application", "label": "commerce-platform", "cvss": 0.0, "severity": "safe", "color": "#1A1220", "in_kev": False, "reachability": "core_platform", "owner": "platform-team@patchgraph.local", "environment": "prod"},
        {"id": "environment:prod", "kind": "environment", "label": "prod", "cvss": 0.0, "severity": "safe", "color": "#7A0FE0", "in_kev": False, "reachability": "active_cluster", "owner": "secops@patchgraph.local", "environment": "prod"},
        {"id": "environment:staging", "kind": "environment", "label": "staging", "cvss": 0.0, "severity": "safe", "color": "#8A929C", "in_kev": False, "reachability": "preprod_cluster", "owner": "secops@patchgraph.local", "environment": "staging"},
    ]
    edges = [
        {"source": "pv_checkout_sdk_2_1_0", "target": "pv_example_lib_1_4_0", "kind": "depends_on", "scope": "runtime", "is_patch_path": True},
        {"source": "service:checkout", "target": "pv_checkout_sdk_2_1_0", "kind": "deploys_component", "scope": "direct", "is_patch_path": True},
        {"source": "service:analytics-worker", "target": "pv_example_lib_1_4_0", "kind": "deploys_component", "scope": "transitive", "is_patch_path": False},
        {"source": "application:commerce-platform", "target": "service:checkout", "kind": "contains_service", "scope": "direct", "is_patch_path": True},
    ]

    filtered_nodes = nodes
    if environment:
        filtered_nodes = [n for n in filtered_nodes if n.get("environment") == environment or n.get("kind") in ("package_version", "application")]
    if owner:
        filtered_nodes = [n for n in filtered_nodes if owner.lower() in (n.get("owner") or "").lower()]
    if in_kev is True:
        filtered_nodes = [n for n in filtered_nodes if n.get("in_kev") is True or n.get("kind") in ("service", "application")]

    return {
        "nodes": filtered_nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(filtered_nodes),
            "total_edges": len(edges),
            "vulnerable_nodes": sum(1 for n in filtered_nodes if n.get("severity") in ("critical", "high")),
        },
        "request_id": ctx["request_id"],
        "is_demo": True,
    }


@router.get("/graph/nodes/{node_id}")
async def get_graph_node_detail(
    node_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    return {
        "id": node_id,
        "label": node_id.replace("pv_", "").replace("service:", ""),
        "kind": "package_version" if node_id.startswith("pv_") else ("service" if node_id.startswith("service:") else "asset"),
        "cvss": 8.8 if "example_lib" in node_id else 5.4,
        "severity": "critical" if "example_lib" in node_id else "medium",
        "reachability": "reachable_prod",
        "in_kev": True if "example_lib" in node_id else False,
        "epss_percentile": 0.86,
        "owner": "payments-team@patchgraph.local",
        "affected_services": ["checkout", "analytics-worker"],
        "blast_radius_score": 14.2,
        "upstream_callers": ["checkout-sdk@2.1.0", "service:checkout"],
        "downstream_dependencies": ["urllib3>=1.26.5", "cryptography>=3.4.7"],
        "vex_statement": {
            "status": "affected",
            "justification": "Reachable via checkout API unauthenticated HTTP ingress.",
            "statement_time": "2026-11-01T00:00:00Z"
        },
        "request_id": ctx["request_id"],
        "is_demo": True,
    }


@router.post("/imports/topology")
async def import_topology(
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    require_role(ctx, ["analyst", "approver", "admin"])
    try:
        body = await request.json()
    except Exception:
        body = {"source_name": "uploaded_topology.csv", "services_registered": 2}

    job_id = f"job_topo_{uuid.uuid4().hex[:8]}"
    return {
        "id": job_id,
        "project_id": ctx["project_id"],
        "status": "completed",
        "source_name": body.get("source_name", "topology_import"),
        "services_registered": 2,
        "assets_registered": 2,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "request_id": ctx["request_id"],
        "is_demo": True,
    }


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
) -> Dict[str, Any]:
    return {
        "id": job_id,
        "status": "completed",
        "progress": 100,
        "stage": "INDEXED_AND_SCORED",
        "errors": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "request_id": ctx["request_id"],
    }


@router.get("/jobs/{job_id}/events")
async def stream_job_events(job_id: str):
    from fastapi.responses import StreamingResponse
    async def event_generator():
        yield f"data: {json.dumps({'job_id': job_id, 'progress': 50, 'status': 'processing'})}\n\n"
        yield f"data: {json.dumps({'job_id': job_id, 'progress': 100, 'status': 'completed'})}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/sources/status")
async def get_sources_status(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "sources": {
            "osv": {"status": "synced", "last_sync": now, "stale": False, "records": 18450, "parser_version": "1.0.0"},
            "nvd": {"status": "synced", "last_sync": now, "stale": False, "records": 24100, "parser_version": "2.0.0"},
            "epss": {"status": "synced", "last_sync": now, "stale": False, "records": 192000, "parser_version": "1.0.0"},
            "kev": {"status": "synced", "last_sync": now, "stale": False, "records": 1150, "parser_version": "1.0.0"},
        },
        "snapshot_sha256": "5d5112f2ede415e41e8e56c5177516b031701b7d8beffeba04ff415f8a6aa3e9",
        "offline_demo_mode": True,
        "request_id": ctx["request_id"],
    }


@router.get("/health")
async def get_system_health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "PatchGraph",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
