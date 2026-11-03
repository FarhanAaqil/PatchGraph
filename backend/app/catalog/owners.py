"""Service and team ownership routing for findings and remediation actions (Day 30)."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List

from backend.app.db.session import DatabaseManager


def build_owner_routing_queues(db: DatabaseManager, project_id: str) -> Dict[str, List[Dict[str, Any]]]:
    rows = db.conn.execute(
        """SELECT f.id AS finding_id, v.canonical_id, p.normalized_name AS package_name,
                  pv.version, s.name AS service_name, s.owner_email, e.name AS environment,
                  f.applicability, fs.final_score
           FROM findings f
           JOIN vulnerabilities v ON f.vulnerability_id = v.id
           JOIN package_versions pv ON f.package_version_id = pv.id
           JOIN packages p ON pv.package_id = p.id
           LEFT JOIN services s ON f.service_id = s.id
           LEFT JOIN environments e ON f.environment_id = e.id
           LEFT JOIN finding_scores fs ON fs.finding_id = f.id
           WHERE f.project_id = ?
           ORDER BY fs.final_score DESC""",
        (project_id,),
    ).fetchall()

    queues: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        owner = r["owner_email"] or "unassigned@patchgraph.local"
        queues[owner].append(
            {
                "finding_id": r["finding_id"],
                "canonical_id": r["canonical_id"],
                "package": f"{r['package_name']}@{r['version']}",
                "service": r["service_name"],
                "environment": r["environment"],
                "applicability": r["applicability"],
                "final_score": r["final_score"],
            }
        )
    return dict(queues)
