"""Day 42 System Gate Suite (`tests/system/test_system_gate.py`).

Proves Gate 6 (System Ready) exit criteria:
- Local OIDC-compatible authentication token issuance, signature verification, and expiry rejection
- Role-based permission matrix (`viewer`, `analyst`, `approver`, `admin`)
- Structured observability metrics and secret-redacted logs
- Full database backup and cryptographic SHA-256 verified restore drill
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.app.db.session import DatabaseManager
from backend.app.jobs.recovery import create_database_backup, restore_database_from_backup
from backend.app.observability import ObservabilityRegistry
from backend.app.security.auth import issue_local_oidc_token, verify_local_oidc_token
from backend.app.security.policy import check_permission


class TestPhase6SystemGate(unittest.TestCase):
    def test_oidc_auth_and_rbac_policy_matrix(self) -> None:
        token = issue_local_oidc_token(
            user_id="u_01",
            email="approver@patchgraph.local",
            project_id="proj_01",
            role="approver",
            ttl_seconds=300,
        )
        principal = verify_local_oidc_token(token)
        self.assertEqual(principal.role, "approver")
        self.assertTrue(check_permission(principal.role, "approve:plans"))
        self.assertFalse(check_permission("analyst", "approve:plans"))
        self.assertFalse(check_permission("viewer", "write:imports"))

        # Expired token must raise PermissionError
        expired_token = issue_local_oidc_token("u_01", "a@b.c", "proj_01", "viewer", ttl_seconds=-10)
        with self.assertRaises(PermissionError):
            verify_local_oidc_token(expired_token)

    def test_observability_registry_and_backup_restore_drill(self) -> None:
        obs = ObservabilityRegistry()
        obs.record_request("/api/v1/findings", 12.4, 200, "req_1", "fetched findings")
        obs.record_request("/api/v1/findings", 18.6, 200, "req_2", "api_key=secret123456789")
        summary = obs.summary()
        self.assertEqual(summary["routes"]["/api/v1/findings"]["count"], 2)
        self.assertIn("[REDACTED_SECRET]", obs.structured_logs[1]["message"])

        # Execute live backup and restore drill
        db = DatabaseManager(":memory:")
        with tempfile.TemporaryDirectory() as tmpdir:
            backup_file = Path(tmpdir) / "patchgraph_backup.sql"
            meta = create_database_backup(db, backup_file)
            restored_db = restore_database_from_backup(backup_file, meta["sha256"])

            orig_findings = db.conn.execute("SELECT id, applicability FROM findings ORDER BY id").fetchall()
            rest_findings = restored_db.conn.execute("SELECT id, applicability FROM findings ORDER BY id").fetchall()
            self.assertEqual([dict(r) for r in orig_findings], [dict(r) for r in rest_findings])

            with self.assertRaises(ValueError):
                restore_database_from_backup(backup_file, "0" * 64)


if __name__ == "__main__":
    unittest.main()
