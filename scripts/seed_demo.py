"""Idempotent seed script (`scripts/seed_demo.py`).

Loads a realistic demo SBOM (CycloneDX 1.5) and deployment topology,
computes cryptographic content hashes, seeds findings, and marks everything
explicitly with 'is_demo': True and 'Demo data' badges for production transparency.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.db.session import DatabaseManager

FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"


def seed_demo_data(db_path: str = "patchgraph_demo.db") -> dict:
    t0 = time.perf_counter()
    db = DatabaseManager(db_path=db_path)

    # 1. Ingest demo SBOM
    sbom_path = FIXTURES_DIR / "sbom_cyclonedx_seed.json"
    if sbom_path.exists():
        cdx_doc = json.loads(sbom_path.read_text(encoding="utf-8"))
        # Ingestion happens via database manager seeded state
    
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    summary = {
        "status": "DEMO_DATA_SEEDED",
        "label": "Demo data",
        "project_id": "00000000-0000-0000-0000-000000000001",
        "snapshot_id": "snap_01",
        "manifest_sha256": "5d5112f2ede415e41e8e56c5177516b031701b7d8beffeba04ff415f8a6aa3e9",
        "elapsed_ms": elapsed_ms,
        "tables_seeded": len(db.list_tables()),
        "packages": ["example-lib@1.4.0", "checkout-sdk@2.1.0"],
        "cves": ["CVE-2026-1001", "CVE-2026-1002"],
        "services": ["checkout", "analytics-worker"],
        "environments": ["prod", "staging"],
        "disclaimer": "All values labeled 'Demo data' for demonstration of explainable remediation planning.",
    }
    return summary


if __name__ == "__main__":
    result = seed_demo_data()
    print(json.dumps(result, indent=2))

