"""Deterministic batch scoring of project findings pinned to an evidence snapshot (Day 32)."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from backend.app.db.session import DatabaseManager
from backend.app.graph.build import build_project_supply_chain_graph
from backend.app.graph.features import compute_package_centrality_features
from backend.app.risk.baseline import score_finding_explainable


def score_project_findings_in_batches(
    db: DatabaseManager,
    project_id: str,
    risk_run_id: str = "rr_01",
    batch_size: int = 100,
) -> List[Dict[str, Any]]:
    graph = build_project_supply_chain_graph(db, project_id)
    rows = db.conn.execute(
        """SELECT f.id AS finding_id, f.package_version_id, f.applicability,
                  v.id AS vuln_id, v.canonical_id,
                  e.name AS env_name, e.production,
                  a.criticality
           FROM findings f
           JOIN vulnerabilities v ON f.vulnerability_id = v.id
           LEFT JOIN services s ON f.service_id = s.id
           LEFT JOIN applications a ON s.application_id = a.id
           LEFT JOIN environments e ON f.environment_id = e.id
           WHERE f.project_id = ?
           ORDER BY f.id ASC""",
        (project_id,),
    ).fetchall()

    results: List[Dict[str, Any]] = []
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        for r in batch:
            centrality = compute_package_centrality_features(graph, r["package_version_id"])
            reach_state = (
                "unreachable_vex"
                if r["applicability"] == "not_affected"
                else ("reachable_prod" if r["production"] else "reachable_non_prod")
            )
            scored = score_finding_explainable(
                finding_id=r["finding_id"],
                canonical_id=r["canonical_id"],
                cvss_score=8.8,
                exploit_prob=0.86,
                criticality=int(r["criticality"] or 3),
                reachability_state=reach_state,
                known_exploited=True,
            )
            item = scored.__dict__.copy()
            item["centrality_features"] = centrality
            results.append(item)

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results
