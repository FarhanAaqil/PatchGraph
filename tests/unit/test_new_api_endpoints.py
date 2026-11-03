"""Unit tests for newly added API endpoints and seed scripts (`tests/unit/test_new_api_endpoints.py`)."""
from __future__ import annotations

import unittest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.db.session import DatabaseManager
from backend.app.api import routes as api_routes
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
        res_topo = self.client.post("/api/v1/imports/topology", json={"source_name": "test_topo.csv"}, headers=self.headers)
        self.assertEqual(res_topo.status_code, 200)
        self.assertEqual(res_topo.json()["status"], "completed")

        res_job = self.client.get("/api/v1/jobs/job_01", headers=self.headers)
        self.assertEqual(res_job.status_code, 200)
        self.assertEqual(res_job.json()["progress"], 100)

    def test_sources_status_and_health(self) -> None:
        res_src = self.client.get("/api/v1/sources/status", headers=self.headers)
        self.assertEqual(res_src.status_code, 200)
        self.assertIn("osv", res_src.json()["sources"])

        res_health = self.client.get("/health")
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.json()["status"], "ok")

    def test_seed_demo_script(self) -> None:
        res = seed_demo_data(db_path=":memory:")
        self.assertEqual(res["status"], "DEMO_DATA_SEEDED")
        self.assertEqual(res["label"], "Demo data")
        self.assertEqual(res["tables_seeded"], 26)


if __name__ == "__main__":
    unittest.main()
