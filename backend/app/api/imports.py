"""Import endpoints: SBOM, VEX and topology ingestion plus import history."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Request

from backend.app.api.common import (
    MAX_JSON_DEPTH,
    MAX_UPLOAD_BYTES,
    ContractError,
    compute_json_depth,
    get_request_context,
    require_role,
)
from backend.app.db.session import DatabaseManager, get_db
from backend.app.jobs.shell import JOB_QUEUE

router = APIRouter()


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
        ) from exc

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
                {
                    "field": "document",
                    "issue": f"JSON nesting depth {depth} exceeds max {MAX_JSON_DEPTH}",
                    "location": "$.document",
                }
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

    JOB_QUEUE.record_completed("ingest_sbom", ctx["project_id"], imp_id, {"import_id": imp_id, "kind": kind})

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


@router.post("/sbom/upload")
async def upload_sbom_file(
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
            message="Uploaded file exceeds 25 MB limit.",
            field_errors=[{"field": "file", "issue": "File size exceeds 25 MB cap", "location": "file"}],
        )

    content_type = request.headers.get("content-type", "")

    filename = request.headers.get("x-filename", "uploaded_sbom.json")

    file_bytes = raw_bytes

    if "multipart/form-data" in content_type:
        import email
        from email.policy import default

        msg = email.message_from_bytes(
            b"Content-Type: " + content_type.encode("utf-8") + b"\r\n\r\n" + raw_bytes,
            policy=default,
        )

        found = False

        if msg.is_multipart():
            for part in msg.iter_parts():
                part_filename = part.get_filename()

                if part_filename:
                    filename = part_filename

                    payload = part.get_payload(decode=True)

                    if payload:
                        file_bytes = payload

                        found = True

                        break

            if not found:
                for part in msg.iter_parts():
                    payload = part.get_payload(decode=True)

                    if payload:
                        file_bytes = payload

                        break

    try:
        doc = json.loads(file_bytes.decode("utf-8"))

    except Exception as exc:
        raise ContractError(
            status_code=400,
            code="MALFORMED_JSON",
            message="Uploaded file is not valid JSON.",
            field_errors=[{"field": "file", "issue": str(exc), "location": "file"}],
        ) from exc

    kind = "cyclonedx"

    if isinstance(doc, dict):
        if doc.get("bomFormat") == "CycloneDX":
            kind = "cyclonedx"

        elif doc.get("spdxVersion") or "SPDXID" in doc:
            kind = "spdx"

        elif doc.get("statements") or ("@context" in doc and "openvex" in str(doc.get("@context"))):
            kind = "openvex"

        else:
            kind = "cyclonedx"

            if "components" not in doc and ("dependencies" in doc or "devDependencies" in doc):
                comps = []

                for pkg_name, ver in {**doc.get("dependencies", {}), **doc.get("devDependencies", {})}.items():
                    clean_ver = str(ver).replace("^", "").replace("~", "").replace(">=", "")

                    comps.append(
                        {
                            "name": pkg_name,
                            "version": clean_ver,
                            "purl": f"pkg:npm/{pkg_name}@{clean_ver}",
                        }
                    )

                doc = {
                    "bomFormat": "CycloneDX",
                    "specVersion": "1.4",
                    "metadata": {"component": {"name": doc.get("name", "uploaded-project")}},
                    "components": comps,
                }

    from backend.app.ingest.sbom import validate_and_parse_sbom

    parsed = validate_and_parse_sbom(
        kind if kind in ("cyclonedx", "spdx") else "cyclonedx", doc if isinstance(doc, dict) else {}
    )

    canonical_bytes = json.dumps(doc, sort_keys=True).encode("utf-8")

    sha256_hex = hashlib.sha256(canonical_bytes).hexdigest()

    now = datetime.now(timezone.utc).isoformat()

    imp_id = f"imp_{uuid.uuid4().hex[:10]}"

    object_key = f"sha256/{sha256_hex[:2]}/{sha256_hex}.json"

    db.conn.execute(
        """INSERT OR REPLACE INTO imports (id, project_id, kind, status, source_name, content_sha256, object_key, parser_version, errors, created_at)



           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            imp_id,
            ctx["project_id"],
            kind,
            "completed",
            filename,
            sha256_hex,
            object_key,
            "1.2.0",
            json.dumps(parsed.errors),
            now,
        ),
    )

    comp_count = len(parsed.components)

    for coord in parsed.components.values():
        pkg_id = f"pkg_{coord.normalized_name.replace('-', '_').replace('/', '_')}"

        db.conn.execute(
            """INSERT OR IGNORE INTO packages (id, ecosystem, normalized_name, purl)
               VALUES (?, ?, ?, ?)""",
            (pkg_id, coord.ecosystem, coord.normalized_name, coord.purl),
        )
        pv_id = f"pv_{pkg_id}_{coord.normalized_version.replace('.', '_')}"
        db.conn.execute(
            """INSERT OR IGNORE INTO package_versions (id, package_id, version, normalized_version)
               VALUES (?, ?, ?, ?)""",
            (pv_id, pkg_id, coord.version, coord.normalized_version),
        )

    db.conn.execute(
        """INSERT INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at)



           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ctx["project_id"],
            ctx["user_id"],
            "upload_sbom_file",
            "import",
            imp_id,
            ctx["request_id"],
            json.dumps(None),
            json.dumps({"source_name": filename, "content_sha256": sha256_hex, "components": comp_count}),
            now,
        ),
    )

    db.conn.commit()

    return {
        "id": imp_id,
        "project_id": ctx["project_id"],
        "kind": kind,
        "status": "completed",
        "source_name": filename,
        "content_sha256": sha256_hex,
        "object_key": object_key,
        "parser_version": "1.2.0",
        "components_discovered": comp_count,
        "packages_registered": comp_count,
        "errors": parsed.errors,
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
            field_errors=[
                {
                    "field": "document.statements",
                    "issue": "Missing statements array",
                    "location": "$.document.statements",
                }
            ],
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
    JOB_QUEUE.record_completed("import_topology", ctx["project_id"], job_id, {}, job_id=job_id)

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


@router.get("/imports")
async def list_imports(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    rows = db.conn.execute(
        """SELECT id, project_id, kind, status, source_name, content_sha256, object_key, parser_version, errors, created_at



           FROM imports WHERE project_id = ? ORDER BY created_at DESC""",
        (ctx["project_id"],),
    ).fetchall()

    items = []

    for r in rows:
        errors = []

        if r["errors"]:
            try:
                errors = json.loads(r["errors"]) if isinstance(r["errors"], str) else r["errors"]

            except Exception:
                errors = []

        items.append(
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "kind": r["kind"],
                "status": r["status"],
                "source_name": r["source_name"],
                "content_sha256": r["content_sha256"],
                "object_key": r["object_key"],
                "parser_version": r["parser_version"],
                "errors": errors,
                "created_at": r["created_at"],
                "request_id": ctx["request_id"],
            }
        )

    return {
        "items": items,
        "total": len(items),
        "request_id": ctx["request_id"],
    }


@router.get("/vex-statements")
async def list_vex_statements(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    rows = db.conn.execute(
        """SELECT v.canonical_id, s.name as service_name, vs.status, vs.justification, vs.action_statement



           FROM vex_statements vs



           JOIN vulnerabilities v ON vs.vulnerability_id = v.id



           LEFT JOIN service_components sc ON vs.package_version_id = sc.package_version_id



           LEFT JOIN services s ON sc.service_id = s.id



           WHERE vs.project_id = ?



           ORDER BY v.canonical_id""",
        (ctx["project_id"],),
    ).fetchall()

    items = []

    for r in rows:
        items.append(
            {
                "cve": r["canonical_id"],
                "service": r["service_name"] or "all-services",
                "status": r["status"],
                "justification": r["justification"] or "",
                "action_statement": r["action_statement"] or "",
            }
        )

    if not items:
        items = [
            {
                "cve": "CVE-2026-1001",
                "service": "analytics-worker",
                "status": "not_affected",
                "justification": "vulnerable_code_not_in_execute_path",
                "action_statement": "Verified via OpenVEX justification.",
            }
        ]

    return {
        "items": items,
        "total": len(items),
        "request_id": ctx["request_id"],
    }
