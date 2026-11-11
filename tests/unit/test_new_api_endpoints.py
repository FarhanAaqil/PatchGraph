"""Unit tests for newly added API endpoints and seed scripts (`tests/unit/test_new_api_endpoints.py`)."""

from __future__ import annotations

import json
import unittest

from fastapi.testclient import TestClient

from backend.app.api import routes as api_routes
from backend.app.db.session import DatabaseManager
from backend.app.main import create_app
from scripts.seed_demo import seed_demo_data


class TestExtendedApiEndpoints(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        app = create_app()
        app.dependency_overrides[api_routes.get_db] = lambda: self.db
        self.client = TestClient(app)
        self.headers = {
            "X-Project-Id": "00000000-0000-0000-0000-000000000001",
            "X-User-Id": "00000000-0000-0000-0000-000000000010",
            "X-User-Role": "admin",
        }

    def test_audit_list_and_filter(self) -> None:
        res = self.client.get("/api/v1/audit", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertGreaterEqual(data["total"], 1)

    def test_audit_export_json_and_csv(self) -> None:
        # JSON export
        res_json = self.client.get("/api/v1/audit/export?format=json", headers=self.headers)
        self.assertEqual(res_json.status_code, 200)
        self.assertIn("items", res_json.json())

        # CSV export
        res_csv = self.client.get("/api/v1/audit/export?format=csv", headers=self.headers)
        self.assertEqual(res_csv.status_code, 200)
        self.assertEqual(res_csv.headers["content-type"], "text/csv; charset=utf-8")
        self.assertIn("id,project_id,actor_id", res_csv.text)

    def test_findings_explain(self) -> None:
        res = self.client.get("/api/v1/findings/finding_seed_01/explain", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["finding_id"], "finding_seed_01")
        self.assertIn("factors", data)
        self.assertIn("formula", data)
        self.assertIn("calibration_notes", data)

    def test_plans_list_and_detail(self) -> None:
        res_list = self.client.get("/api/v1/plans", headers=self.headers)
        self.assertEqual(res_list.status_code, 200)
        self.assertGreaterEqual(res_list.json()["total"], 1)

        res_detail = self.client.get("/api/v1/plans/plan_01", headers=self.headers)
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.json()["id"], "plan_01")
        self.assertIn("actions", res_detail.json())

    def test_graph_and_node_detail(self) -> None:
        res_graph = self.client.get("/api/v1/graph?environment=prod", headers=self.headers)
        self.assertEqual(res_graph.status_code, 200)
        graph_data = res_graph.json()
        self.assertIn("nodes", graph_data)
        self.assertIn("edges", graph_data)

        res_node = self.client.get("/api/v1/graph/nodes/pv_example_lib_1_4_0", headers=self.headers)
        self.assertEqual(res_node.status_code, 200)
        self.assertEqual(res_node.json()["id"], "pv_example_lib_1_4_0")
        self.assertTrue(res_node.json()["in_kev"])

    def test_topology_import_and_jobs(self) -> None:
        res_topo = self.client.post(
            "/api/v1/imports/topology", json={"source_name": "test_topo.csv"}, headers=self.headers
        )
        self.assertEqual(res_topo.status_code, 200)
        self.assertEqual(res_topo.json()["status"], "completed")

        res_job = self.client.get(f"/api/v1/jobs/{res_topo.json()['id']}", headers=self.headers)
        self.assertEqual(res_job.status_code, 200)
        self.assertEqual(res_job.json()["status"], "completed")
        self.assertEqual(res_job.json()["progress"], 100)

        res_missing = self.client.get("/api/v1/jobs/job_does_not_exist", headers=self.headers)
        self.assertEqual(res_missing.status_code, 404)
        self.assertEqual(res_missing.json()["code"], "JOB_NOT_FOUND")

    def test_sources_status_and_health(self) -> None:
        res_src = self.client.get("/api/v1/sources/status", headers=self.headers)
        self.assertEqual(res_src.status_code, 200)
        self.assertIn("osv", res_src.json()["sources"])

        res_health = self.client.get("/health")
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.json()["status"], "ok")

    def test_sources_status_comes_from_the_stored_snapshot_not_constants(self) -> None:
        res = self.client.get("/api/v1/sources/status", headers=self.headers).json()
        self.assertEqual(res["data_freshness"], "synchronized")
        self.assertEqual(res["snapshot_id"], "snap_01")
        self.assertTrue(all("records" not in src for src in res["sources"].values()), "no invented record counts")

        row = self.db.conn.execute("SELECT id, source_cutoffs FROM evidence_snapshots").fetchone()
        cutoffs = json.loads(row["source_cutoffs"])
        cutoffs["epss"]["stale"] = True
        self.db.conn.execute(
            "UPDATE evidence_snapshots SET source_cutoffs = ? WHERE id = ?", (json.dumps(cutoffs), row["id"])
        )
        self.db.conn.commit()
        self.client.app.state.response_cache.invalidate()  # the edit above bypassed the API

        stale = self.client.get("/api/v1/sources/status", headers=self.headers).json()
        self.assertEqual(stale["data_freshness"], "stale")
        self.assertEqual(stale["sources"]["epss"]["status"], "stale")

    def test_approval_state_follows_the_recorded_decision(self) -> None:
        self.client.post("/api/v1/demo/load-sample", headers=self.headers)
        plan = self.client.post(
            "/api/v1/plans",
            headers=self.headers,
            json={
                "risk_run_id": "rr_01",
                "budget_hours": 40,
                "max_downtime_minutes": 30,
                "environments": ["prod"],
                "objective": "weighted_exposure",
            },
        ).json()
        plan_id = plan["id"]

        def state_in_list() -> str:
            items = self.client.get("/api/v1/plans", headers=self.headers).json()["items"]
            return next(p for p in items if p["id"] == plan_id)["approval_state"]

        self.assertEqual(state_in_list(), "pending_human_approval")
        decided = self.client.post(
            f"/api/v1/plans/{plan_id}/decision",
            headers=self.headers,
            json={"decision": "approved", "reason": "Checked against staging"},
        )
        self.assertEqual(decided.status_code, 200)
        self.assertEqual(state_in_list(), "approved")
        detail = self.client.get(f"/api/v1/plans/{plan_id}", headers=self.headers).json()
        self.assertEqual(detail["approval_state"], "approved")

    def test_forced_reseed_never_deletes_memberships(self) -> None:
        """A reload of the sample data must not open a window where every caller looks like a non-member."""
        statements: list[str] = []
        self.db.conn.set_trace_callback(statements.append)
        self.db.seed_phase1_scenario(force=True)
        self.db.conn.set_trace_callback(None)
        deletes = [s for s in statements if s.upper().startswith("DELETE FROM")]
        self.assertTrue(deletes, "the reseed should still clear the data tables")
        for identity_table in ("memberships", "users", "projects"):
            self.assertNotIn(f"DELETE FROM {identity_table}", deletes)
        count = self.db.conn.execute("SELECT COUNT(*) FROM memberships").fetchone()[0]
        self.assertEqual(count, 3)

    def test_seed_demo_script(self) -> None:
        res = seed_demo_data(db_path=":memory:")
        self.assertEqual(res["status"], "DEMO_DATA_SEEDED")
        self.assertEqual(res["label"], "Demo data")
        self.assertEqual(res["tables_seeded"], 26)

    def test_imports_list(self) -> None:
        res = self.client.get("/api/v1/imports", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertGreaterEqual(data["total"], 1)

    def test_risk_runs_latest(self) -> None:
        res = self.client.get("/api/v1/risk-runs/latest", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("id", data)
        self.assertIn("model_version", data)

    def test_vex_statements_list(self) -> None:
        res = self.client.get("/api/v1/vex-statements", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("total", data)

    def test_model_card(self) -> None:
        res = self.client.get("/api/v1/model-card", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["model_name"], "PatchGraph Exploit Likelihood Calibrator")
        self.assertIn("brier_score", data)
        self.assertIn("pr_auc", data)


if __name__ == "__main__":
    unittest.main()
