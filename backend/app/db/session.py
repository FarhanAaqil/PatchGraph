"""SQLite store and deterministic demo seed for PatchGraph.

The canonical schema is the PostgreSQL-flavoured DDL in `backend/migrations/001_core.sql`. This module
translates it to SQLite at start-up, keeping every table, primary key, unique constraint, CHECK constraint
and index, and stores data in the file named by `PATCHGRAPH_SQLITE_PATH` (default `data/patchgraph.db`).
There is no PostgreSQL driver: pointing the app at a Postgres server is not supported yet.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
from pathlib import Path
from typing import List, Optional


class ThreadSafeConnection:
    """Thread-safe proxy for sqlite3.Connection to prevent InterfaceError under concurrent FastAPI requests."""

    def __init__(self, conn: sqlite3.Connection, lock: threading.RLock) -> None:
        self._conn = conn
        self._lock = lock

    def execute(self, *args, **kwargs):
        with self._lock:
            return self._conn.execute(*args, **kwargs)

    def executemany(self, *args, **kwargs):
        with self._lock:
            return self._conn.executemany(*args, **kwargs)

    def commit(self):
        with self._lock:
            return self._conn.commit()

    def cursor(self):
        with self._lock:
            return self._conn.cursor()

    @property
    def row_factory(self):
        return self._conn.row_factory

    @row_factory.setter
    def row_factory(self, val):
        self._conn.row_factory = val

    def __getattr__(self, name: str):
        return getattr(self._conn, name)


IDENTITY_TABLES = frozenset({"projects", "users", "memberships"})

MIGRATION_SQL_PATH = Path(__file__).resolve().parent.parent.parent / "migrations" / "001_core.sql"

CANONICAL_TABLES = [
    "projects",
    "users",
    "memberships",
    "applications",
    "services",
    "environments",
    "assets",
    "packages",
    "package_versions",
    "imports",
    "dependencies",
    "service_components",
    "deployments",
    "vulnerabilities",
    "advisories",
    "affected_ranges",
    "exploit_evidence",
    "vex_statements",
    "evidence_snapshots",
    "findings",
    "risk_runs",
    "finding_scores",
    "planning_runs",
    "remediation_actions",
    "plan_decisions",
    "audit_logs",
]

CANONICAL_INDEXES = [
    "idx_assets_project_environment",
    "idx_dependencies_parent",
    "idx_dependencies_child",
    "idx_service_components_version",
    "idx_findings_project_status",
    "idx_findings_vulnerability",
    "idx_scores_run_rank",
    "idx_advisories_vulnerability_source",
    "idx_advisories_payload_gin",
    "idx_audit_project_created",
]


def translate_postgres_ddl_to_sqlite(pg_sql: str) -> List[str]:
    """Translate `001_core.sql` PostgreSQL 16 statements into executable SQLite DDL."""
    statements: List[str] = []
    for raw_line in pg_sql.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("--"):
            continue
        if line.upper().startswith("CREATE EXTENSION"):
            continue
        if "USING gin(" in line:
            # GIN index is PostgreSQL-specific; recorded in schema inspection, skipped in SQLite engine
            continue
        stmt = line
        stmt = re.sub(r"\bCREATE\s+TABLE\s+", "CREATE TABLE IF NOT EXISTS ", stmt, flags=re.I)
        stmt = re.sub(r"\bCREATE\s+INDEX\s+", "CREATE INDEX IF NOT EXISTS ", stmt, flags=re.I)
        stmt = re.sub(r"\bid\s+bigserial\s+PRIMARY\s+KEY\b", "id INTEGER PRIMARY KEY AUTOINCREMENT", stmt, flags=re.I)
        stmt = re.sub(r"\buuid\b", "TEXT", stmt, flags=re.I)
        stmt = re.sub(r"\btimestamptz\b", "TEXT", stmt, flags=re.I)
        stmt = re.sub(r"\bjsonb\b", "TEXT", stmt, flags=re.I)
        stmt = re.sub(r"\bsmallint\b", "INTEGER", stmt, flags=re.I)
        stmt = re.sub(r"\bdouble precision\b", "REAL", stmt, flags=re.I)
        stmt = re.sub(r"\bboolean\b", "INTEGER", stmt, flags=re.I)
        stmt = re.sub(r"\bchar\(64\)", "TEXT", stmt, flags=re.I)
        stmt = re.sub(r"DEFAULT\s+gen_random_uuid\(\)", "", stmt, flags=re.I)
        stmt = re.sub(r"DEFAULT\s+now\(\)", "DEFAULT CURRENT_TIMESTAMP", stmt, flags=re.I)
        stmt = re.sub(r"DEFAULT\s+false\b", "DEFAULT 0", stmt, flags=re.I)
        stmt = re.sub(r"DEFAULT\s+true\b", "DEFAULT 1", stmt, flags=re.I)
        statements.append(stmt)
    return statements


class DatabaseManager:
    """Manages schema migration, seeded scenario initialization, and project-scoped queries."""

    def __init__(self, db_path: str = ":memory:") -> None:
        self.db_path = db_path
        self._lock = threading.RLock()
        raw_conn = sqlite3.connect(db_path, check_same_thread=False, timeout=30.0)
        raw_conn.row_factory = sqlite3.Row
        raw_conn.execute("PRAGMA foreign_keys = ON;")
        if db_path != ":memory:":
            try:
                raw_conn.execute("PRAGMA journal_mode = WAL;")
            except Exception:
                pass
        self.conn = ThreadSafeConnection(raw_conn, self._lock)
        self.apply_migrations()
        self.seed_phase1_scenario()

    def apply_migrations(self) -> None:
        pg_sql = MIGRATION_SQL_PATH.read_text(encoding="utf-8")
        for stmt in translate_postgres_ddl_to_sqlite(pg_sql):
            self.conn.execute(stmt)
        self.conn.commit()

    def list_tables(self) -> List[str]:
        rows = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        return [r["name"] for r in rows]

    def list_indexes(self) -> List[str]:
        rows = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        return [r["name"] for r in rows]

    def seed_phase1_scenario(self, force: bool = False) -> None:
        """Seed the deterministic Phase 1 Architecture Skeleton scenario."""
        cur = self.conn.cursor()
        if force:
            # Identity tables are left in place: wiping memberships even briefly makes every concurrent
            # request look like a non-member and fail with 403 while the sample data is reloaded.
            for tbl in reversed(CANONICAL_TABLES):
                if tbl in IDENTITY_TABLES:
                    continue
                cur.execute(f"DELETE FROM {tbl}")
            self.conn.commit()
        else:
            existing = cur.execute("SELECT COUNT(*) AS c FROM projects").fetchone()["c"]
            if existing > 0:
                return

        now = "2026-11-01T00:00:00Z"
        project_id = "00000000-0000-0000-0000-000000000001"
        other_project_id = "00000000-0000-0000-0000-000000000002"
        user_approver = "00000000-0000-0000-0000-000000000010"
        user_analyst = "00000000-0000-0000-0000-000000000011"
        user_viewer = "00000000-0000-0000-0000-000000000012"

        cur.execute(
            "INSERT OR IGNORE INTO projects (id, name, created_at) VALUES (?, ?, ?), (?, ?, ?)",
            (project_id, "commerce-platform-prod", now, other_project_id, "isolated-tenant-project", now),
        )
        cur.execute(
            "INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
            (
                user_approver,
                "approver@patchgraph.local",
                "Lead Security Approver",
                now,
                user_analyst,
                "analyst@patchgraph.local",
                "AppSec Analyst",
                now,
                user_viewer,
                "viewer@patchgraph.local",
                "Platform Viewer",
                now,
            ),
        )
        cur.execute(
            "INSERT OR IGNORE INTO memberships (project_id, user_id, role) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
            (
                project_id,
                user_approver,
                "approver",
                project_id,
                user_analyst,
                "analyst",
                project_id,
                user_viewer,
                "viewer",
            ),
        )

        app_id = "app_commerce_01"
        cur.execute(
            "INSERT OR IGNORE INTO applications (id, project_id, name, criticality) VALUES (?, ?, ?, ?)",
            (app_id, project_id, "commerce-platform", 5),
        )

        svc_checkout = "svc_checkout_01"
        svc_analytics = "svc_analytics_02"
        cur.execute(
            "INSERT OR IGNORE INTO services (id, application_id, name, owner_email) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
            (
                svc_checkout,
                app_id,
                "checkout",
                "payments-team@patchgraph.local",
                svc_analytics,
                app_id,
                "analytics-worker",
                "data-team@patchgraph.local",
            ),
        )

        env_prod = "env_prod_01"
        env_staging = "env_staging_02"
        cur.execute(
            "INSERT OR IGNORE INTO environments (id, project_id, name, production, max_downtime_minutes) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
            (env_prod, project_id, "prod", 1, 30, env_staging, project_id, "staging", 0, 120),
        )

        asset_checkout = "asset_k8s_checkout_prod"
        asset_analytics = "asset_vm_analytics_staging"
        cur.execute(
            "INSERT OR IGNORE INTO assets (id, project_id, environment_id, external_key, kind, criticality, metadata) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)",
            (
                asset_checkout,
                project_id,
                env_prod,
                "prod-cluster/checkout-deployment",
                "container_deployment",
                5,
                json.dumps({"region": "ap-south-1", "tier": "pci-dss"}),
                asset_analytics,
                project_id,
                env_staging,
                "staging-worker/analytics-batch",
                "worker_node",
                2,
                json.dumps({"region": "ap-south-1", "tier": "internal"}),
            ),
        )

        cur.execute(
            "INSERT OR IGNORE INTO deployments (id, service_id, asset_id, deployed_at, release_ref) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
            (
                "dep_01",
                svc_checkout,
                asset_checkout,
                now,
                "rel-2026.11.01",
                "dep_02",
                svc_analytics,
                asset_analytics,
                now,
                "rel-2026.11.01",
            ),
        )

        pkg_sdk = "pkg_checkout_sdk"
        pkg_example = "pkg_example_lib"
        pkg_urllib3 = "pkg_urllib3"
        cur.execute(
            "INSERT OR IGNORE INTO packages (id, ecosystem, normalized_name, purl) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
            (
                pkg_sdk,
                "pypi",
                "checkout-sdk",
                "pkg:pypi/checkout-sdk",
                pkg_example,
                "pypi",
                "example-lib",
                "pkg:pypi/example-lib",
                pkg_urllib3,
                "pypi",
                "urllib3",
                "pkg:pypi/urllib3",
            ),
        )

        pv_sdk = "pv_checkout_sdk_2_1_0"
        pv_example_140 = "pv_example_lib_1_4_0"
        pv_example_143 = "pv_example_lib_1_4_3"
        pv_urllib3_202 = "pv_urllib3_2_0_2"
        cur.execute(
            "INSERT OR IGNORE INTO package_versions (id, package_id, version, normalized_version) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
            (
                pv_sdk,
                pkg_sdk,
                "2.1.0",
                "2.1.0",
                pv_example_140,
                pkg_example,
                "1.4.0",
                "1.4.0",
                pv_example_143,
                pkg_example,
                "1.4.3",
                "1.4.3",
                pv_urllib3_202,
                pkg_urllib3,
                "2.0.2",
                "2.0.2",
            ),
        )

        imp_sbom = "imp_seed_sbom_01"
        imp_vex = "imp_seed_vex_01"
        cur.execute(
            """INSERT OR IGNORE INTO imports (id, project_id, kind, status, source_name, content_sha256, object_key, parser_version, errors, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                imp_sbom,
                project_id,
                "cyclonedx",
                "completed",
                "sbom_cyclonedx_seed.json",
                "4a7d1ed414474e4033ac29ccb8653d9b00000000000000000000000000000001",
                "sha256/4a/sbom_cyclonedx_seed.json",
                "1.0.0",
                "[]",
                now,
                imp_vex,
                project_id,
                "vex",
                "completed",
                "vex_openvex_seed.json",
                "7b52009b64fd0a2a49e6d8a93975307700000000000000000000000000000002",
                "sha256/7b/vex_openvex_seed.json",
                "1.0.0",
                "[]",
                now,
            ),
        )

        cur.execute(
            """INSERT OR IGNORE INTO dependencies (project_id, parent_version_id, child_version_id, scope, optional, import_id)
               VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                pv_sdk,
                pv_example_140,
                "runtime",
                0,
                imp_sbom,
                project_id,
                pv_sdk,
                pv_urllib3_202,
                "runtime",
                0,
                imp_sbom,
            ),
        )

        cur.execute(
            """INSERT OR IGNORE INTO service_components (service_id, environment_id, package_version_id, import_id, direct)
               VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)""",
            (
                svc_checkout,
                env_prod,
                pv_sdk,
                imp_sbom,
                1,
                svc_checkout,
                env_prod,
                pv_example_140,
                imp_sbom,
                0,
                svc_analytics,
                env_staging,
                pv_example_140,
                imp_sbom,
                0,
            ),
        )

        vuln_01 = "vuln_cve_2026_1001"
        vuln_02 = "vuln_cve_2023_45803"
        cur.execute(
            "INSERT OR IGNORE INTO vulnerabilities (id, canonical_id, published_at, modified_at, summary) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
            (
                vuln_01,
                "CVE-2026-1001",
                "2026-10-10T00:00:00Z",
                now,
                "Remote token deserialization bypass in example-lib transitive handler.",
                vuln_02,
                "CVE-2023-45803",
                "2023-10-17T00:00:00Z",
                now,
                "Request body not stripped after redirect from 303 status changes.",
            ),
        )

        adv_osv = "adv_osv_2026_1001"
        adv_nvd = "adv_nvd_2026_1001"
        cur.execute(
            """INSERT OR IGNORE INTO advisories (id, vulnerability_id, source, external_id, source_url, fetched_at, content_sha256, raw_object_key, payload)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                adv_osv,
                vuln_01,
                "osv",
                "OSV-2026-1001",
                "https://api.osv.dev/v1/vulns/OSV-2026-1001",
                now,
                "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
                "snapshots/osv/OSV-2026-1001.json",
                json.dumps({"cvss": 8.8, "fixed": "1.4.3"}),
                adv_nvd,
                vuln_01,
                "nvd",
                "CVE-2026-1001",
                "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2026-1001",
                now,
                "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
                "snapshots/nvd/CVE-2026-1001.json",
                json.dumps({"cvss_v3_score": 8.8, "cwe": "CWE-502"}),
            ),
        )

        cur.execute(
            "INSERT OR IGNORE INTO affected_ranges (advisory_id, package_id, range_type, introduced, fixed, last_affected) VALUES (?, ?, ?, ?, ?, ?)",
            (adv_osv, pkg_example, "SEMVER", "1.0.0", "1.4.3", "1.4.2"),
        )

        cur.execute(
            """INSERT OR IGNORE INTO exploit_evidence (vulnerability_id, observed_on, source, epss, percentile, known_exploited, evidence)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                vuln_01,
                "2026-11-01",
                "epss+kev",
                0.86,
                0.98,
                1,
                json.dumps(
                    {
                        "epss_url": "https://api.first.org/data/v1/epss?cve=CVE-2026-1001",
                        "kev_url": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
                    }
                ),
            ),
        )

        cur.execute(
            """INSERT OR IGNORE INTO vex_statements (id, project_id, import_id, vulnerability_id, package_version_id, status, justification, action_statement)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "vex_stmt_01",
                project_id,
                imp_vex,
                vuln_01,
                pv_example_140,
                "not_affected",
                "vulnerable_code_not_in_execute_path",
                "analytics-worker does not invoke token parser.",
            ),
        )

        snap_id = "snap_01"
        manifest_sha = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        source_cutoffs = {
            "osv": {
                "source_url": "https://api.osv.dev/v1/querybatch",
                "fetched_at": now,
                "content_sha256": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
                "parser_version": "1.0.0",
                "stale": False,
            },
            "nvd": {
                "source_url": "https://services.nvd.nist.gov/rest/json/cves/2.0",
                "fetched_at": now,
                "content_sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
                "parser_version": "1.0.0",
                "stale": False,
            },
            "epss": {
                "source_url": "https://api.first.org/data/v1/epss",
                "fetched_at": now,
                "content_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
                "parser_version": "1.0.0",
                "stale": False,
            },
            "kev": {
                "source_url": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
                "fetched_at": now,
                "content_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "parser_version": "1.0.0",
                "stale": False,
            },
        }
        cur.execute(
            "INSERT OR IGNORE INTO evidence_snapshots (id, project_id, created_at, source_cutoffs, manifest_sha256) VALUES (?, ?, ?, ?, ?)",
            (snap_id, project_id, now, json.dumps(source_cutoffs), manifest_sha),
        )

        finding_01 = "finding_seed_01"
        finding_02 = "finding_seed_02"
        cur.execute(
            """INSERT OR IGNORE INTO findings (id, project_id, vulnerability_id, package_version_id, service_id, environment_id, applicability, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                finding_01,
                project_id,
                vuln_01,
                pv_example_140,
                svc_checkout,
                env_prod,
                "affected",
                "open",
                finding_02,
                project_id,
                vuln_01,
                pv_example_140,
                svc_analytics,
                env_staging,
                "not_affected",
                "open",
            ),
        )

        rr_id = "rr_01"
        cur.execute(
            "INSERT OR IGNORE INTO risk_runs (id, project_id, snapshot_id, model_version, config, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (
                rr_id,
                project_id,
                snap_id,
                "baseline-logreg-v1",
                json.dumps(
                    {
                        "alpha": 0.4,
                        "beta": 2.5,
                        "gamma": 0.4,
                        "delta": 1.5,
                        "epsilon": 1.5,
                        "lambda": 1.0,
                    }
                ),
                now,
            ),
        )

        factors_01 = {
            "severity": 3.52,
            "exploit_probability": 2.15,
            "criticality": 2.00,
            "reachability": 1.50,
            "kev_bonus": 1.50,
            "uncertainty_penalty": 0.10,
            "weights": {"alpha": 0.4, "beta": 2.5, "gamma": 0.4, "delta": 1.5, "epsilon": 1.5, "lambda": 1.0},
        }
        factors_02 = {
            "severity": 3.52,
            "exploit_probability": 2.15,
            "criticality": 0.80,
            "reachability": 0.15,
            "kev_bonus": 1.50,
            "uncertainty_penalty": 0.29,
            "weights": {"alpha": 0.4, "beta": 2.5, "gamma": 0.4, "delta": 1.5, "epsilon": 1.5, "lambda": 1.0},
        }
        cur.execute(
            """INSERT OR IGNORE INTO finding_scores (risk_run_id, finding_id, probability, baseline_score, final_score, uncertainty, factors)
               VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)""",
            (
                rr_id,
                finding_01,
                0.86,
                8.80,
                10.57,
                0.10,
                json.dumps(factors_01),
                rr_id,
                finding_02,
                0.86,
                4.10,
                7.83,
                0.29,
                json.dumps(factors_02),
            ),
        )

        plan_id = "plan_01"
        cur.execute(
            """INSERT OR IGNORE INTO planning_runs (id, project_id, risk_run_id, status, objective_value, best_bound, runtime_ms, constraints, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                plan_id,
                project_id,
                rr_id,
                "optimal",
                18.4,
                18.4,
                12,
                json.dumps(
                    {
                        "budget_hours": 40,
                        "max_downtime_minutes": 30,
                        "environments": ["prod"],
                        "objective": "weighted_exposure",
                    }
                ),
                now,
            ),
        )

        cur.execute(
            """INSERT OR IGNORE INTO remediation_actions (id, planning_run_id, package_id, from_version, to_version, action_type, selected, effort_hours, downtime_minutes, compatibility_risk, risk_removed, rationale)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "act_seed_01",
                plan_id,
                pkg_example,
                "1.4.0",
                "1.4.3",
                "upgrade",
                1,
                6.0,
                10,
                0.08,
                18.4,
                json.dumps(
                    {
                        "services": ["checkout"],
                        "resolved_findings": [finding_01, finding_02],
                        "reason": "Patch version upgrade resolves CVE-2026-1001 within 30m downtime cap.",
                    }
                ),
                "act_seed_02_rejected",
                plan_id,
                pkg_example,
                "1.4.0",
                "2.0.0",
                "major_upgrade",
                0,
                16.0,
                45,
                0.65,
                18.4,
                json.dumps(
                    {
                        "services": ["checkout"],
                        "rejected_reason": "Violates max_downtime_minutes (45 > 30) and higher compatibility risk (0.65).",
                    }
                ),
            ),
        )

        cur.execute(
            """INSERT OR IGNORE INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                user_analyst,
                "seed_skeleton_initialized",
                "project",
                project_id,
                "req_seed_init_00",
                json.dumps(None),
                json.dumps({"snapshot_id": snap_id, "risk_run_id": rr_id, "planning_run_id": plan_id}),
                now,
            ),
        )

        self.conn.commit()


_DEFAULT_DB: Optional[DatabaseManager] = None


def get_db() -> DatabaseManager:
    global _DEFAULT_DB
    if _DEFAULT_DB is None:
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        default_db = repo_root / "data" / "patchgraph.db"
        default_db.parent.mkdir(parents=True, exist_ok=True)
        db_path = os.environ.get("PATCHGRAPH_SQLITE_PATH", str(default_db))
        _DEFAULT_DB = DatabaseManager(db_path=db_path)
    return _DEFAULT_DB
