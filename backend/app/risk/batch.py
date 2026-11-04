"""Deterministic batch scoring of project findings pinned to an evidence snapshot (Day 32)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.app.db.session import DatabaseManager
from backend.app.graph.build import build_project_supply_chain_graph
from backend.app.graph.features import compute_package_centrality_features
from backend.app.risk.baseline import score_finding_explainable
from intelligence.risk.model import predict_vulnerability_exploit_risk


def score_project_findings_in_batches(
    db: DatabaseManager,
    project_id: str,
    risk_run_id: str = "rr_01",
    batch_size: int = 100,
) -> List[Dict[str, Any]]:
    graph = build_project_supply_chain_graph(db, project_id)
    rows = db.conn.execute(
        """SELECT f.id AS finding_id, f.package_version_id, f.applicability,
                  v.id AS vuln_id, v.canonical_id, v.published_at,
                  e.name AS env_name, e.production,
                  a.criticality,
                  ee.epss, ee.known_exploited,
                  (SELECT payload FROM advisories adv WHERE adv.vulnerability_id = v.id ORDER BY adv.fetched_at DESC LIMIT 1) AS advisory_payload
           FROM findings f
           JOIN vulnerabilities v ON f.vulnerability_id = v.id
           LEFT JOIN exploit_evidence ee ON ee.vulnerability_id = v.id
           LEFT JOIN services s ON f.service_id = s.id
           LEFT JOIN applications a ON s.application_id = a.id
           LEFT JOIN environments e ON f.environment_id = e.id
           WHERE f.project_id = ?
           ORDER BY f.id ASC""",
        (project_id,),
    ).fetchall()

    results: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        for r in batch:
            centrality = compute_package_centrality_features(graph, r["package_version_id"])
            reach_state = (
                "unreachable_vex"
                if r["applicability"] == "not_affected"
                else ("reachable_prod" if r["production"] else "reachable_non_prod")
            )

            # Parse CVSS score and CWE from advisory payload if available
            cvss_score: Optional[float] = None
            is_rce_or_deser = False
            if r["advisory_payload"]:
                try:
                    adv_data = json.loads(r["advisory_payload"])
                    raw_cvss = adv_data.get("cvss") or adv_data.get("cvss_v3_score")
                    if raw_cvss is not None:
                        cvss_score = float(raw_cvss)
                    cwe_str = str(adv_data.get("cwe") or "")
                    if any(x in cwe_str for x in ["CWE-502", "CWE-94", "CWE-78", "RCE"]):
                        is_rce_or_deser = True
                except Exception:
                    pass

            epss_val = float(r["epss"]) if r["epss"] is not None else None
            is_known_exploited = bool(r["known_exploited"]) if r["known_exploited"] is not None else False

            # Compute age in days
            age_days = 30
            if r["published_at"]:
                try:
                    pub = datetime.fromisoformat(r["published_at"].replace("Z", "+00:00"))
                    age_days = max(1, (now - pub).days)
                except Exception:
                    age_days = 30

            # Dynamic calibrated ML model prediction
            ml_pred = predict_vulnerability_exploit_risk(
                cve_id=r["canonical_id"],
                cvss_score=cvss_score,
                epss=epss_val,
                age_days=age_days,
                is_remote_vector=True,
                is_deserialization_or_rce_cwe=is_rce_or_deser,
                reference_count=4,
            )

            scored = score_finding_explainable(
                finding_id=r["finding_id"],
                canonical_id=r["canonical_id"],
                cvss_score=cvss_score,
                exploit_prob=ml_pred["probability"],
                criticality=int(r["criticality"] or 3),
                reachability_state=reach_state,
                known_exploited=is_known_exploited,
            )

            item = scored.__dict__.copy()
            item["centrality_features"] = centrality
            item["ml_exploit_factors"] = ml_pred["feature_contributions"]
            item["ml_model_version"] = ml_pred["model_version"]
            results.append(item)

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results
