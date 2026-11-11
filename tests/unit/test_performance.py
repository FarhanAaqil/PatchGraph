"""Caching, revalidation, compression, pagination and index coverage."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from backend.app.api import routes as api_routes
from backend.app.db.session import DatabaseManager
from backend.app.main import create_app

HEADERS = {
    "X-Project-Id": "00000000-0000-0000-0000-000000000001",
    "X-User-Id": "00000000-0000-0000-0000-000000000010",
}


def make_client() -> tuple[TestClient, DatabaseManager]:
    db = DatabaseManager(":memory:")
    app = create_app()
    app.dependency_overrides[api_routes.get_db] = lambda: db
    return TestClient(app), db


class TestResponseCache(unittest.TestCase):
    def setUp(self) -> None:
        self.client, self.db = make_client()
        self.client.post("/api/v1/demo/load-sample", headers=HEADERS)

    def test_second_read_is_served_from_the_server_cache(self) -> None:
        first = self.client.get("/api/v1/findings", headers=HEADERS)
        second = self.client.get("/api/v1/findings", headers=HEADERS)
        self.assertEqual(first.headers["x-cache"], "MISS")
        self.assertEqual(second.headers["x-cache"], "HIT")
        self.assertEqual(first.json(), second.json())
        self.assertIn("app;dur=", second.headers["server-timing"])

    def test_etag_revalidation_returns_an_empty_304(self) -> None:
        res = self.client.get("/api/v1/findings", headers=HEADERS)
        etag = res.headers["etag"]
        self.assertEqual(res.headers["cache-control"], "no-cache")
        again = self.client.get("/api/v1/findings", headers={**HEADERS, "If-None-Match": etag})
        self.assertEqual(again.status_code, 304)
        self.assertEqual(again.content, b"")

    def test_a_write_invalidates_the_cache_immediately(self) -> None:
        self.client.get("/api/v1/audit", headers=HEADERS)
        self.assertEqual(self.client.get("/api/v1/audit", headers=HEADERS).headers["x-cache"], "HIT")
        self.client.post("/api/v1/demo/load-sample", headers=HEADERS)
        self.assertEqual(self.client.get("/api/v1/audit", headers=HEADERS).headers["x-cache"], "MISS")

    def test_callers_never_share_cache_entries(self) -> None:
        self.client.get("/api/v1/findings", headers=HEADERS)
        other_project = {**HEADERS, "X-Project-Id": "00000000-0000-0000-0000-000000000002"}
        res = self.client.get("/api/v1/findings", headers=other_project)
        self.assertEqual(res.status_code, 403, "a cached answer for one caller must not leak to another")

    def test_origin_is_part_of_the_cache_key(self) -> None:
        self.client.get("/api/v1/findings", headers={**HEADERS, "Origin": "http://localhost:5173"})
        res = self.client.get("/api/v1/findings", headers={**HEADERS, "Origin": "https://evil.example.com"})
        self.assertNotIn("access-control-allow-origin", res.headers)

    def test_large_json_is_compressed(self) -> None:
        res = self.client.get("/api/v1/graph", headers={**HEADERS, "Accept-Encoding": "gzip"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-encoding"), "gzip")


class TestPagination(unittest.TestCase):
    def setUp(self) -> None:
        self.client, _ = make_client()
        self.client.post("/api/v1/demo/load-sample", headers=HEADERS)

    def test_findings_are_paged_and_report_the_total(self) -> None:
        page = self.client.get("/api/v1/findings?limit=1&offset=0", headers=HEADERS).json()
        self.assertEqual(len(page["items"]), 1)
        self.assertEqual((page["limit"], page["offset"]), (1, 0))
        self.assertGreaterEqual(page["total"], 2)
        second = self.client.get("/api/v1/findings?limit=1&offset=1", headers=HEADERS).json()
        self.assertNotEqual(page["items"][0]["id"], second["items"][0]["id"])

    def test_findings_filter_and_search_run_in_sql(self) -> None:
        everything = self.client.get("/api/v1/findings", headers=HEADERS).json()
        staging = self.client.get("/api/v1/findings?environment=staging", headers=HEADERS).json()
        self.assertTrue(0 < staging["total"] < everything["total"])
        hit = self.client.get("/api/v1/findings?q=checkout", headers=HEADERS).json()
        self.assertTrue(all(i["service_name"] == "checkout" for i in hit["items"]))
        none = self.client.get("/api/v1/findings?q=zzz-no-such-thing", headers=HEADERS).json()
        self.assertEqual((none["total"], none["items"]), (0, []))
        kev = self.client.get("/api/v1/findings?kev_only=true", headers=HEADERS).json()
        self.assertTrue(all(i["factors"]["raw_inputs"]["known_exploited"] for i in kev["items"]))

    def test_limit_is_bounded(self) -> None:
        self.assertEqual(self.client.get("/api/v1/findings?limit=100000", headers=HEADERS).status_code, 400)

    def test_finding_detail_does_not_load_the_whole_list(self) -> None:
        top = self.client.get("/api/v1/findings?limit=1", headers=HEADERS).json()["items"][0]
        detail = self.client.get(f"/api/v1/findings/{top['id']}", headers=HEADERS)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(self.client.get("/api/v1/findings/nope", headers=HEADERS).status_code, 404)

    def test_imports_and_assets_are_paged(self) -> None:
        imports = self.client.get("/api/v1/imports?limit=1", headers=HEADERS).json()
        self.assertEqual(len(imports["items"]), 1)
        self.assertGreaterEqual(imports["total"], 1)
        assets = self.client.get("/api/v1/assets?limit=1", headers=HEADERS).json()
        self.assertLessEqual(len(assets["items"]), 1)
        self.assertIn("total", assets)


class TestIndexes(unittest.TestCase):
    def test_secondary_indexes_are_created_and_used(self) -> None:
        db = DatabaseManager(":memory:")
        names = set(db.list_indexes())
        for expected in ("idx_findings_project_env", "idx_imports_project_created", "idx_plan_decisions_run"):
            self.assertIn(expected, names)
        plan = db.conn.execute(
            "EXPLAIN QUERY PLAN SELECT * FROM imports WHERE project_id = ? ORDER BY created_at DESC LIMIT 5",
            ("p",),
        ).fetchall()
        self.assertIn("idx_imports_project_created", " ".join(str(tuple(r)) for r in plan))


if __name__ == "__main__":
    unittest.main()
