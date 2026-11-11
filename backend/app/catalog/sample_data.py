"""Sample dataset loader for PatchGraph demo & automated test execution.

Loads CycloneDX 1.5 SBOM components, deployment topology mappings,
vulnerabilities, advisories, exploit evidence, and computes calibrated
ML risk scores and CP-SAT remediation plans.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from backend.app.db.session import DatabaseManager
from backend.app.risk.batch import score_project_findings_in_batches

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "tests" / "fixtures"


def load_sample_dataset(
    db: DatabaseManager, project_id: str = "00000000-0000-0000-0000-000000000001"
) -> Dict[str, Any]:
    # Reset and seed database with Phase 1 scenario
    db.seed_phase1_scenario(force=True)
    now = datetime.now(timezone.utc).isoformat()

    # Dynamic batch scoring using calibrated ML model
    scored_items = score_project_findings_in_batches(db, project_id)
    cur = db.conn.cursor()
    for item in scored_items:
        cur.execute(
            """INSERT OR REPLACE INTO finding_scores (risk_run_id, finding_id, probability, baseline_score, final_score, uncertainty, factors)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "rr_01",
                item["finding_id"],
                item["probability"],
                item["baseline_score"],
                item["final_score"],
                item["uncertainty"],
                json.dumps(item["factors"]),
            ),
        )

    # Record Audit Log Entry for data loading
    cur.execute(
        """INSERT INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            project_id,
            "00000000-0000-0000-0000-000000000011",
            "load_sample_dataset",
            "project",
            project_id,
            "req_load_sample_01",
            json.dumps(None),
            json.dumps({"packages": 3, "findings": len(scored_items), "snapshot_id": "snap_01", "label": "Demo data"}),
            now,
        ),
    )
    db.conn.commit()

    return {
        "status": "ok",
        "message": "Sample dataset (CycloneDX SBOM + Topology + Calibrated Risk Findings) loaded successfully.",
        "project_id": project_id,
        "snapshot_id": "snap_01",
        "packages_loaded": 3,
        "vulnerabilities_loaded": 2,
        "findings_loaded": len(scored_items),
        "services_loaded": 2,
        "plans_loaded": 1,
        "is_demo": True,
    }
