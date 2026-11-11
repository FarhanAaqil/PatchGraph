"""Asset inventory and the dependency/deployment graph."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from backend.app.api.common import (
    ContractError,
    get_request_context,
)
from backend.app.db.session import DatabaseManager, get_db

router = APIRouter()


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
        {
            "source": "service:checkout",
            "target": "pv_checkout_sdk_2_1_0",
            "kind": "deploys_component",
            "scope": "direct",
        },
        {
            "source": "service:analytics-worker",
            "target": "pv_example_lib_1_4_0",
            "kind": "deploys_component",
            "scope": "transitive",
        },
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
        {
            "id": "pv_example_lib_1_4_0",
            "kind": "package_version",
            "label": "example-lib@1.4.0",
            "cvss": 8.8,
            "severity": "critical",
            "color": "#7A0FE0",
            "in_kev": True,
            "reachability": "reachable_prod",
            "owner": "payments-team@patchgraph.local",
            "environment": "prod",
        },
        {
            "id": "pv_checkout_sdk_2_1_0",
            "kind": "package_version",
            "label": "checkout-sdk@2.1.0",
            "cvss": 5.4,
            "severity": "medium",
            "color": "#8A929C",
            "in_kev": False,
            "reachability": "direct_caller",
            "owner": "payments-team@patchgraph.local",
            "environment": "prod",
        },
        {
            "id": "service:checkout",
            "kind": "service",
            "label": "checkout",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#4B0F9E",
            "in_kev": False,
            "reachability": "ingress_gateway",
            "owner": "payments-team@patchgraph.local",
            "environment": "prod",
        },
        {
            "id": "service:analytics-worker",
            "kind": "service",
            "label": "analytics-worker",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#4B0F9E",
            "in_kev": False,
            "reachability": "worker_queue",
            "owner": "analytics-team@patchgraph.local",
            "environment": "staging",
        },
        {
            "id": "application:commerce-platform",
            "kind": "application",
            "label": "commerce-platform",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#1A1220",
            "in_kev": False,
            "reachability": "core_platform",
            "owner": "platform-team@patchgraph.local",
            "environment": "prod",
        },
        {
            "id": "environment:prod",
            "kind": "environment",
            "label": "prod",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#7A0FE0",
            "in_kev": False,
            "reachability": "active_cluster",
            "owner": "secops@patchgraph.local",
            "environment": "prod",
        },
        {
            "id": "environment:staging",
            "kind": "environment",
            "label": "staging",
            "cvss": 0.0,
            "severity": "safe",
            "color": "#8A929C",
            "in_kev": False,
            "reachability": "preprod_cluster",
            "owner": "secops@patchgraph.local",
            "environment": "staging",
        },
    ]

    edges = [
        {
            "source": "pv_checkout_sdk_2_1_0",
            "target": "pv_example_lib_1_4_0",
            "kind": "depends_on",
            "scope": "runtime",
            "is_patch_path": True,
        },
        {
            "source": "service:checkout",
            "target": "pv_checkout_sdk_2_1_0",
            "kind": "deploys_component",
            "scope": "direct",
            "is_patch_path": True,
        },
        {
            "source": "service:analytics-worker",
            "target": "pv_example_lib_1_4_0",
            "kind": "deploys_component",
            "scope": "transitive",
            "is_patch_path": False,
        },
        {
            "source": "application:commerce-platform",
            "target": "service:checkout",
            "kind": "contains_service",
            "scope": "direct",
            "is_patch_path": True,
        },
    ]

    filtered_nodes = nodes

    if environment:
        filtered_nodes = [
            n
            for n in filtered_nodes
            if n.get("environment") == environment or n.get("kind") in ("package_version", "application")
        ]

    if owner:
        filtered_nodes = [n for n in filtered_nodes if owner.lower() in (n.get("owner") or "").lower()]

    if in_kev is True:
        filtered_nodes = [
            n for n in filtered_nodes if n.get("in_kev") is True or n.get("kind") in ("service", "application")
        ]

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
        "kind": "package_version"
        if node_id.startswith("pv_")
        else ("service" if node_id.startswith("service:") else "asset"),
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
            "statement_time": "2026-11-01T00:00:00Z",
        },
        "request_id": ctx["request_id"],
        "is_demo": True,
    }
