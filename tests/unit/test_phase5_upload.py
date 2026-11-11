"""Unit tests for Phase 5 real file upload and ingestion (`tests/unit/test_phase5_upload.py`)."""

from __future__ import annotations

import json
import unittest

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


class TestPhase5Upload(unittest.TestCase):
    def setUp(self) -> None:
        self.headers = {
            "x-project-id": "00000000-0000-0000-0000-000000000001",
            "x-user-id": "00000000-0000-0000-0000-000000000010",  # approver in seed
        }

    def test_upload_cyclonedx_direct_json(self) -> None:
        doc = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.5",
            "metadata": {"component": {"name": "sample-payment-app"}},
            "components": [
                {"name": "stripe", "version": "5.1.0", "purl": "pkg:pypi/stripe@5.1.0"},
                {"name": "requests", "version": "2.28.1", "purl": "pkg:pypi/requests@2.28.1"},
            ],
        }
        res = client.post(
            "/api/v1/sbom/upload",
            content=json.dumps(doc).encode("utf-8"),
            headers={**self.headers, "Content-Type": "application/json", "x-filename": "payment_bom.json"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["kind"], "cyclonedx")
        self.assertEqual(data["source_name"], "payment_bom.json")
        self.assertEqual(data["components_discovered"], 2)
        self.assertEqual(data["packages_registered"], 2)
        self.assertTrue(data["content_sha256"])

    def test_upload_multipart_form_data(self) -> None:
        boundary = "---------------------------974767299852498929531610575"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="service_bom.json"\r\n'
            f"Content-Type: application/json\r\n\r\n"
            f'{{"bomFormat":"CycloneDX","specVersion":"1.5","components":[{{"name":"flask","version":"2.3.0","purl":"pkg:pypi/flask@2.3.0"}}]}}\r\n'
            f"--{boundary}--\r\n"
        ).encode("utf-8")

        res = client.post(
            "/api/v1/sbom/upload",
            content=body,
            headers={**self.headers, "Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["source_name"], "service_bom.json")
        self.assertEqual(data["components_discovered"], 1)

    def test_upload_package_json_autowrapped(self) -> None:
        doc = {
            "name": "my-express-app",
            "version": "1.0.0",
            "dependencies": {
                "express": "^4.18.2",
                "lodash": "4.17.21",
            },
        }
        res = client.post(
            "/api/v1/sbom/upload",
            content=json.dumps(doc).encode("utf-8"),
            headers={**self.headers, "Content-Type": "application/json", "x-filename": "package.json"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["components_discovered"], 2)

    def test_upload_malformed_json_returns_400(self) -> None:
        res = client.post(
            "/api/v1/sbom/upload",
            content=b"not valid json here",
            headers={**self.headers, "Content-Type": "application/json", "x-filename": "broken.json"},
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(data["code"], "MALFORMED_JSON")
