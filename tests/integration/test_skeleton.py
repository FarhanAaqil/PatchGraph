"""Day 7 Integration Suite (`tests/integration/test_skeleton.py`).

Proves Gate 1 (Architecture Skeleton) exit criteria:
- Full seeded round-trip across all 12 `/api/v1` endpoints
- Idempotent SBOM/VEX ingestion with content SHA-256 provenance
- Failure-path validation with `{code, message, field_errors, request_id}`
- Bounded graph traversal depth/limit enforcement
- Constrained plan optimization, what-if simulation, and human approval audit record
- Project-scoped RBAC authorization enforcement
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.api import routes as api_routes
from backend.app.db.session import DatabaseManager
from backend.app.main import create_app

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"


class TestArchitectureSkeletonIntegration(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        app = create_app()
        app.dependency_overrides[api_routes.get_db] = lambda: self.db
        self.client = TestClient(app)
        self.default_headers = {
            "X-Project-Id": "00000000-0000-0000-0000-000000000001",
            "X-User-Id": "00000000-0000-0000-0000-000000000010",
            "X-User-Role": "approver",
        }

    def test_full_seeded_round_trip_across_all_12_endpoints(self) -> None:
        # 1. POST /api/v1/imports/sbom (CycloneDX 1.5 seed)
        cdx_doc = json.loads((FIXTURES_DIR / "sbom_cyclonedx_seed.json").read_text(encoding="utf-8"))
        res_sbom = self.client.post(
            "/api/v1/imports/sbom",
            headers=self.default_headers,
            json={"kind": "cyclonedx", "source_name": "sbom_cyclonedx_seed.json", "document": cdx_doc},
        )
        self.assertEqual(res_sbom.status_code, 200)
        sbom_body = res_sbom.json()
        self.assertEqual(sbom_body["status"], "completed")
        self.assertEqual(len(sbom_body["content_sha256"]), 64)
        self.assertIn("request_id", sbom_body)

        # Idempotent re-upload returns identical import ID and SHA-256
        res_sbom_dup = self.client.post(
            "/api/v1/imports/sbom",
            headers=self.default_headers,
            json={"kind": "cyclonedx", "source_name": "sbom_cyclonedx_seed.json", "document": cdx_doc},
        )
        self.assertEqual(res_sbom_dup.status_code, 200)
        self.assertEqual(res_sbom_dup.json()["id"], sbom_body["id"])

        # 2. POST /api/v1/imports/vex (OpenVEX seed)
        vex_doc = json.loads((FIXTURES_DIR / "vex_openvex_seed.json").read_text(encoding="utf-8"))
        res_vex = self.client.post(
            "/api/v1/imports/vex",
            headers=self.default_headers,
            json={"source_name": "vex_openvex_seed.json", "document": vex_doc},
        )
        self.assertEqual(res_vex.status_code, 200)
        self.assertEqual(res_vex.json()["kind"], "vex")

        # 3. GET /api/v1/imports/{id}
        res_imp_get = self.client.get(f"/api/v1/imports/{sbom_body['id']}", headers=self.default_headers)
        self.assertEqual(res_imp_get.status_code, 200)
        self.assertEqual(res_imp_get.json()["content_sha256"], sbom_body["content_sha256"])

        # 4. GET /api/v1/assets
        res_assets = self.client.get("/api/v1/assets?environment=prod", headers=self.default_headers)
        self.assertEqual(res_assets.status_code, 200)
        assets_body = res_assets.json()
        self.assertEqual(assets_body["total"], 1)
        self.assertEqual(assets_body["items"][0]["services"], ["checkout"])

        # 5. GET /api/v1/findings
        res_findings = self.client.get("/api/v1/findings", headers=self.default_headers)
        self.assertEqual(res_findings.status_code, 200)
        findings_body = res_findings.json()
        self.assertEqual(findings_body["total"], 2)
        top_finding = findings_body["items"][0]
        self.assertEqual(top_finding["id"], "finding_seed_01")
        self.assertEqual(top_finding["service_name"], "checkout")
        self.assertIn("severity", top_finding["factors"])
        self.assertIn("uncertainty_penalty", top_finding["factors"])

        # 6. GET /api/v1/findings/{id}
        res_fdetail = self.client.get(f"/api/v1/findings/{top_finding['id']}", headers=self.default_headers)
        self.assertEqual(res_fdetail.status_code, 200)
        fdetail = res_fdetail.json()
        self.assertTrue(len(fdetail["advisories"]) >= 2)
        self.assertEqual(fdetail["affected_paths"][0]["service"], "checkout")

        # 7. GET /api/v1/graph/paths
        res_paths = self.client.get(
            "/api/v1/graph/paths?package_version_id=pv_example_lib_1_4_0&depth=6",
            headers=self.default_headers,
        )
        self.assertEqual(res_paths.status_code, 200)
        paths_body = res_paths.json()
        self.assertIn("checkout", paths_body["affected_services"])
        self.assertIn("analytics-worker", paths_body["affected_services"])

        # 8. POST /api/v1/risk-runs
        res_rr = self.client.post(
            "/api/v1/risk-runs",
            headers=self.default_headers,
            json={"model_version": "baseline-logreg-v1"},
        )
        self.assertEqual(res_rr.status_code, 200)
        self.assertEqual(res_rr.json()["id"], "rr_01")
        self.assertEqual(len(res_rr.json()["manifest_sha256"]), 64)

        # 9. POST /api/v1/plans (Exact example request from 07_API_PatchGraph.md)
        res_plan = self.client.post(
            "/api/v1/plans",
            headers=self.default_headers,
            json={
                "risk_run_id": "rr_01",
                "budget_hours": 40,
                "max_downtime_minutes": 30,
                "environments": ["prod"],
                "objective": "weighted_exposure",
            },
        )
        self.assertEqual(res_plan.status_code, 200)
        plan_body = res_plan.json()
        self.assertEqual(plan_body["id"], "plan_01")
        self.assertEqual(plan_body["status"], "optimal")
        self.assertTrue(plan_body["risk_removed"] >= 18.4)
        self.assertEqual(plan_body["evidence_snapshot"], "snap_01")
        self.assertEqual(plan_body["actions"][0]["package"], "example-lib")
        self.assertEqual(plan_body["actions"][0]["from"], "1.4.0")
        self.assertEqual(plan_body["actions"][0]["to"], "1.4.3")
        self.assertTrue(len(plan_body["rejected_actions"]) >= 1)
        self.assertTrue(len(plan_body["binding_constraints"]) >= 1)

        # 10. POST /api/v1/plans/{id}/simulate
        res_sim = self.client.post(
            "/api/v1/plans/plan_01/simulate",
            headers=self.default_headers,
            json={"budget_hours": 1, "max_downtime_minutes": 5, "environments": ["prod"]},
        )
        self.assertEqual(res_sim.status_code, 200)
        sim_body = res_sim.json()
        self.assertEqual(sim_body["simulated_plan"]["status"], "infeasible")
        self.assertAlmostEqual(sim_body["deltas"]["risk_removed_delta"], -plan_body["risk_removed"], places=1)

        # 11. POST /api/v1/plans/{id}/decision (Human governance approval + append-only audit log)
        res_dec = self.client.post(
            "/api/v1/plans/plan_01/decision",
            headers=self.default_headers,
            json={
                "decision": "approved",
                "reason": "Approved patch upgrade 1.4.0 -> 1.4.3 within 30m maintenance window.",
            },
        )
        self.assertEqual(res_dec.status_code, 200)
        dec_body = res_dec.json()
        self.assertEqual(dec_body["decision"], "approved")
        self.assertGreater(dec_body["audit_log_id"], 0)

        # 12. GET /api/v1/health/data
        res_health = self.client.get("/api/v1/health/data", headers=self.default_headers)
        self.assertEqual(res_health.status_code, 200)
        health_body = res_health.json()
        self.assertEqual(health_body["overall_status"], "healthy")
        self.assertTrue(health_body["offline_demo_mode"])
        self.assertEqual({s["source"] for s in health_body["sources"]}, {"osv", "nvd", "epss", "kev"})

    def test_failure_paths_and_authorization_boundaries(self) -> None:
        # Malformed SBOM specVersion -> 400 with structured field_errors
        res_bad_sbom = self.client.post(
            "/api/v1/imports/sbom",
            headers=self.default_headers,
            json={
                "kind": "cyclonedx",
                "source_name": "bad.json",
                "document": {"bomFormat": "CycloneDX", "specVersion": "1.0"},
            },
        )
        self.assertEqual(res_bad_sbom.status_code, 400)
        err_body = res_bad_sbom.json()
        self.assertEqual(err_body["code"], "SBOM_VALIDATION_FAILED")
        self.assertTrue(len(err_body["field_errors"]) >= 1)
        self.assertIn("request_id", err_body)

        # Graph depth > 12 -> 400 INVALID_TRAVERSAL_DEPTH
        res_bad_depth = self.client.get("/api/v1/graph/paths?depth=15", headers=self.default_headers)
        self.assertEqual(res_bad_depth.status_code, 400)
        self.assertEqual(res_bad_depth.json()["code"], "INVALID_TRAVERSAL_DEPTH")

        # Infeasible plan -> 422 INFEASIBLE_PLAN
        res_infeasible = self.client.post(
            "/api/v1/plans",
            headers=self.default_headers,
            json={
                "risk_run_id": "rr_01",
                "budget_hours": 1,
                "max_downtime_minutes": 5,
                "environments": ["prod"],
                "objective": "weighted_exposure",
            },
        )
        self.assertEqual(res_infeasible.status_code, 422)
        self.assertEqual(res_infeasible.json()["code"], "INFEASIBLE_PLAN")

        # Viewer or Analyst role attempting to approve a plan -> 403 INSUFFICIENT_ROLE
        analyst_headers = dict(self.default_headers, **{"X-User-Role": "analyst"})
        res_forbidden_role = self.client.post(
            "/api/v1/plans/plan_01/decision",
            headers=analyst_headers,
            json={"decision": "approved", "reason": "Trying to bypass approver check"},
        )
        self.assertEqual(res_forbidden_role.status_code, 403)
        self.assertEqual(res_forbidden_role.json()["code"], "INSUFFICIENT_ROLE")

        # Cross-project access attempt -> 403 FORBIDDEN_PROJECT_SCOPE
        other_project_headers = dict(self.default_headers, **{"X-Project-Id": "00000000-0000-0000-0000-000000000002"})
        res_other_proj = self.client.get("/api/v1/findings", headers=other_project_headers)
        self.assertEqual(res_other_proj.status_code, 403)
        self.assertEqual(res_other_proj.json()["code"], "FORBIDDEN_PROJECT_SCOPE")


if __name__ == "__main__":
    unittest.main()
