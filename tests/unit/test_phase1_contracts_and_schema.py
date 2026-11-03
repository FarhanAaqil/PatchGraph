"""Unit, schema, contract, and failure-path tests for PatchGraph Phase 1 (Days 1-6)."""
from __future__ import annotations

import json
import sqlite3
import unittest
from pathlib import Path
import yaml

from backend.app.db.session import CANONICAL_INDEXES, CANONICAL_TABLES, DatabaseManager, MIGRATION_SQL_PATH
from backend.app.jobs.shell import JobQueueShell

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestPhase1SchemaAndContracts(unittest.TestCase):
    def test_migration_sql_contains_all_26_tables_and_10_indexes(self) -> None:
        sql_text = MIGRATION_SQL_PATH.read_text(encoding="utf-8")
        for table in CANONICAL_TABLES:
            self.assertIn(f"CREATE TABLE {table} ", sql_text, f"Missing table {table} in 001_core.sql")
        self.assertEqual(len(CANONICAL_TABLES), 26)

        for idx in CANONICAL_INDEXES:
            self.assertIn(f"CREATE INDEX {idx} ON ", sql_text, f"Missing index {idx} in 001_core.sql")
        self.assertEqual(len(CANONICAL_INDEXES), 10)

    def test_database_manager_applies_schema_and_enforces_check_constraints(self) -> None:
        db = DatabaseManager(":memory:")
        self.assertEqual(sorted(db.list_tables()), sorted(CANONICAL_TABLES))
        # All 9 B-tree indexes should be created in SQLite (GIN index is Postgres-specific)
        expected_btree_indexes = [i for i in CANONICAL_INDEXES if "gin" not in i]
        for idx in expected_btree_indexes:
            self.assertIn(idx, db.list_indexes())

        # Verify CHECK constraint enforcement: invalid membership role must raise IntegrityError
        with self.assertRaises(sqlite3.IntegrityError):
            db.conn.execute(
                "INSERT INTO memberships (project_id, user_id, role) VALUES (?, ?, ?)",
                ("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000010", "superadmin"),
            )

        # Verify CHECK constraint on applications.criticality (1..5)
        with self.assertRaises(sqlite3.IntegrityError):
            db.conn.execute(
                "INSERT INTO applications (id, project_id, name, criticality) VALUES (?, ?, ?, ?)",
                ("app_bad", "00000000-0000-0000-0000-000000000001", "bad-app", 9),
            )

        # Verify CHECK constraint on exploit_evidence.epss [0,1]
        with self.assertRaises(sqlite3.IntegrityError):
            db.conn.execute(
                "INSERT INTO exploit_evidence (vulnerability_id, observed_on, source, epss, percentile, known_exploited) VALUES (?, ?, ?, ?, ?, ?)",
                ("vuln_cve_2026_1001", "2026-11-02", "epss", 1.5, 0.5, 0),
            )

    def test_openapi_contract_matches_all_12_endpoints(self) -> None:
        backend_spec = (REPO_ROOT / "backend" / "openapi.yaml").read_text(encoding="utf-8")
        shared_spec = (REPO_ROOT / "contracts" / "openapi.yaml").read_text(encoding="utf-8")
        self.assertEqual(backend_spec, shared_spec)

        parsed = yaml.safe_load(backend_spec)
        self.assertEqual(parsed["servers"][0]["url"], "/api/v1")
        expected_paths = {
            "/imports/sbom": "post",
            "/imports/vex": "post",
            "/imports/topology": "post",
            "/imports/{id}": "get",
            "/jobs/{id}": "get",
            "/jobs/{id}/events": "get",
            "/assets": "get",
            "/findings": "get",
            "/findings/{id}": "get",
            "/findings/{id}/explain": "get",
            "/graph": "get",
            "/graph/nodes/{id}": "get",
            "/graph/paths": "get",
            "/risk-runs": "post",
            "/plans": "post",
            "/plans/{id}": "get",
            "/plans/{id}/simulate": "post",
            "/plans/{id}/decision": "post",
            "/audit": "get",
            "/audit/export": "get",
            "/sources/status": "get",
            "/health": "get",
            "/health/data": "get",
        }
        self.assertEqual(set(parsed["paths"].keys()), set(expected_paths.keys()))
        for route, method in expected_paths.items():
            self.assertIn(method, parsed["paths"][route])

    def test_job_queue_enforces_narrow_payload_trust_boundary(self) -> None:
        queue = JobQueueShell()
        job = queue.enqueue("ingest_sbom", "proj_1", "imp_1", {"import_id": "imp_1", "kind": "cyclonedx"})
        self.assertEqual(job.status, "completed")

        with self.assertRaises(ValueError):
            queue.enqueue("ingest_sbom", "proj_1", "imp_1", {"raw_secret_token": "leaked"})

    def test_day1_to_day6_artifacts_and_fixtures_exist(self) -> None:
        required_files = [
            "docs/scope.md",
            "docs/user_flow.md",
            "docs/domain.md",
            "docs/adr/001-architecture.md",
            "docs/data_examples.md",
            "frontend/src/content/terms.ts",
            "frontend/src/app/routes.tsx",
            "frontend/src/api/generated.ts",
            "frontend/src/pages/Imports.tsx",
            "tests/fixtures/sbom_cyclonedx_seed.json",
            "tests/fixtures/sbom_spdx_seed.json",
            "tests/fixtures/vex_openvex_seed.json",
            "tests/fixtures/advisory_snapshot_seed.json",
        ]
        for rel in required_files:
            path = REPO_ROOT / rel
            self.assertTrue(path.exists(), f"Missing Phase 1 artifact: {rel}")

        routes_ts = (REPO_ROOT / "frontend/src/app/routes.tsx").read_text(encoding="utf-8")
        for screen_id in [
            "dashboard",
            "assets",
            "dependency-graph",
            "vulnerabilities",
            "prioritization",
            "finding-detail",
            "explainability",
            "blast-radius",
            "remediation-planner",
            "what-if",
            "imports",
            "runs",
            "audit",
            "data-health",
        ]:
            self.assertIn(f"id: '{screen_id}'", routes_ts)


if __name__ == "__main__":
    unittest.main()
