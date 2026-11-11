"""Authentication boundary: role escalation, token handling, production mode and CORS."""

from __future__ import annotations

import inspect
import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from backend.app.api import routes as api_routes
from backend.app.db.session import DatabaseManager
from backend.app.main import allowed_origins, create_app
from backend.app.security.auth import cap_role, issue_local_oidc_token, verify_local_oidc_token

PROJECT = "00000000-0000-0000-0000-000000000001"
APPROVER = "00000000-0000-0000-0000-000000000010"
VIEWER = "00000000-0000-0000-0000-000000000012"
SBOM_BODY = {"kind": "cyclonedx", "source_name": "t", "document": {"bomFormat": "CycloneDX", "specVersion": "1.5"}}


def build_client(db: DatabaseManager) -> TestClient:
    app = create_app()
    app.dependency_overrides[api_routes.get_db] = lambda: db
    return TestClient(app)


class TestRequestContextThreading(unittest.TestCase):
    def test_context_dependency_stays_on_the_event_loop(self) -> None:
        """A sync dependency would query the shared SQLite connection from a worker thread while handlers
        commit on the loop thread, which produced intermittent FORBIDDEN_PROJECT_SCOPE errors."""
        self.assertTrue(inspect.iscoroutinefunction(api_routes.get_request_context))


class TestRoleEscalation(unittest.TestCase):
    def setUp(self) -> None:
        self.client = build_client(DatabaseManager(":memory:"))

    def test_viewer_cannot_raise_their_role_with_a_header(self) -> None:
        headers = {"X-Project-Id": PROJECT, "X-User-Id": VIEWER, "X-User-Role": "admin"}
        res = self.client.post("/api/v1/imports/sbom", headers=headers, json=SBOM_BODY)
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["code"], "INSUFFICIENT_ROLE")

    def test_role_header_can_still_narrow_permissions(self) -> None:
        headers = {"X-Project-Id": PROJECT, "X-User-Id": APPROVER, "X-User-Role": "viewer"}
        res = self.client.post("/api/v1/imports/sbom", headers=headers, json=SBOM_BODY)
        self.assertEqual(res.status_code, 403)

    def test_cap_role_never_exceeds_the_granted_role(self) -> None:
        self.assertEqual(cap_role("admin", "viewer"), "viewer")
        self.assertEqual(cap_role("viewer", "approver"), "viewer")
        self.assertEqual(cap_role("nonsense", "analyst"), "analyst")
        self.assertEqual(cap_role(None, "approver"), "approver")


class TestBearerTokens(unittest.TestCase):
    def setUp(self) -> None:
        self.client = build_client(DatabaseManager(":memory:"))

    def test_valid_token_is_accepted_and_role_comes_from_membership(self) -> None:
        token = issue_local_oidc_token(VIEWER, "viewer@patchgraph.local", PROJECT, "admin")
        res = self.client.post("/api/v1/imports/sbom", headers={"Authorization": f"Bearer {token}"}, json=SBOM_BODY)
        self.assertEqual(res.status_code, 403, "a token claiming admin must not outrank the viewer membership")

        read = self.client.get("/api/v1/findings", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(read.status_code, 200)

    def test_tampered_expired_and_malformed_tokens_are_rejected(self) -> None:
        good = issue_local_oidc_token(APPROVER, "a@b.c", PROJECT, "approver")
        body, sig = good.rsplit(".", 1)
        for bad in (
            f"{body}.{'0' * len(sig)}",
            "garbage",
            "a.b",
            issue_local_oidc_token(APPROVER, "a@b.c", PROJECT, "approver", ttl_seconds=-5),
        ):
            res = self.client.get("/api/v1/findings", headers={"Authorization": f"Bearer {bad}"})
            self.assertEqual(res.status_code, 401, bad)

    def test_non_bearer_scheme_is_rejected(self) -> None:
        res = self.client.get("/api/v1/findings", headers={"Authorization": "Basic abc"})
        self.assertEqual(res.status_code, 401)

    def test_verify_raises_permission_error_on_garbled_payload(self) -> None:
        with self.assertRaises(PermissionError):
            verify_local_oidc_token("bm90LWpzb24.deadbeef")


class TestProductionMode(unittest.TestCase):
    def test_refuses_to_start_without_a_signing_key(self) -> None:
        env = {"PATCHGRAPH_ENV": "production"}
        with mock.patch.dict(os.environ, env, clear=False):
            os.environ.pop("PATCHGRAPH_AUTH_SIGNING_KEY", None)
            with self.assertRaises(RuntimeError):
                create_app()

    def test_identity_headers_alone_are_not_enough(self) -> None:
        env = {"PATCHGRAPH_ENV": "production", "PATCHGRAPH_AUTH_SIGNING_KEY": "unit-test-key"}
        with mock.patch.dict(os.environ, env, clear=False):
            client = build_client(DatabaseManager(":memory:"))
            anonymous = client.get("/api/v1/findings", headers={"X-User-Id": APPROVER, "X-Project-Id": PROJECT})
            self.assertEqual(anonymous.status_code, 401)

            token = issue_local_oidc_token(APPROVER, "a@b.c", PROJECT, "approver")
            authed = client.get("/api/v1/findings", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(authed.status_code, 200)

    def test_tokens_signed_with_another_key_are_rejected(self) -> None:
        env = {"PATCHGRAPH_ENV": "production", "PATCHGRAPH_AUTH_SIGNING_KEY": "unit-test-key"}
        with mock.patch.dict(os.environ, env, clear=False):
            client = build_client(DatabaseManager(":memory:"))
            forged = issue_local_oidc_token(
                APPROVER, "a@b.c", PROJECT, "admin", signing_key="patchgraph-local-oidc-dev-key"
            )
            res = client.get("/api/v1/findings", headers={"Authorization": f"Bearer {forged}"})
            self.assertEqual(res.status_code, 401)


class TestCors(unittest.TestCase):
    def test_wildcard_origin_is_never_allowed(self) -> None:
        with mock.patch.dict(os.environ, {"CORS_ORIGINS": "*, https://app.example.com"}):
            self.assertEqual(allowed_origins(), ["https://app.example.com"])

    def test_unlisted_origin_gets_no_cors_headers(self) -> None:
        client = build_client(DatabaseManager(":memory:"))
        res = client.get("/health", headers={"Origin": "https://evil.example.com"})
        self.assertNotIn("access-control-allow-origin", res.headers)
        ok = client.get("/health", headers={"Origin": "http://localhost:5173"})
        self.assertEqual(ok.headers.get("access-control-allow-origin"), "http://localhost:5173")


if __name__ == "__main__":
    unittest.main()
