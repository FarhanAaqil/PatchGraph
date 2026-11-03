"""Enrich backend routes with spatial 3D coordinates and metadata for Three.js."""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_FILE = REPO_ROOT / "backend" / "app" / "api" / "routes.py"

def patch_routes():
    content = ROUTES_FILE.read_text(encoding="utf-8")

    old_pattern = r'nodes = \[\s*\{"id": "pv_example_lib_1_4_0"[\s\S]*?\{"id": "environment:staging"[^\}]+\},\s*\]'

    new_nodes_code = """nodes = [
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
    ]"""

    new_content, count = re.subn(old_pattern, new_nodes_code, content)
    if count > 0:
        ROUTES_FILE.write_text(new_content, encoding="utf-8")
        print(f"Successfully enriched {count} occurrence(s) in {ROUTES_FILE}")
    else:
        print("Pattern not found, checking existing content...")

if __name__ == "__main__":
    patch_routes()

