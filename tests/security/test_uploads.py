"""Day 38 Security Suite (`tests/security/test_uploads.py`).

Tests untrusted upload parser limits (size, depth, node count, media type, script injection)
and secret redaction.
"""

from __future__ import annotations

import json
import unittest

from backend.app.security.uploads import redact_secrets, validate_untrusted_upload


class TestPhase6UploadHardeningAndRedaction(unittest.TestCase):
    def test_accepts_valid_json_and_rejects_disallowed_media_type(self) -> None:
        raw = json.dumps({"bomFormat": "CycloneDX", "specVersion": "1.5"}).encode("utf-8")
        parsed = validate_untrusted_upload(raw, "application/vnd.cyclonedx+json")
        self.assertEqual(parsed["specVersion"], "1.5")

        with self.assertRaises(ValueError):
            validate_untrusted_upload(raw, "text/html")

    def test_rejects_deeply_nested_json_bomb_and_script_injection(self) -> None:
        nested: dict = {"leaf": "ok"}
        for _ in range(70):
            nested = {"child": nested}
        with self.assertRaises(ValueError):
            validate_untrusted_upload(json.dumps(nested).encode("utf-8"), "application/json")

        xss_payload = json.dumps({"name": "<script>alert(1)</script>"}).encode("utf-8")
        with self.assertRaises(ValueError):
            validate_untrusted_upload(xss_payload, "application/json")

    def test_redacts_secrets_in_logs(self) -> None:
        msg = "Connector error with token=ghp_1234567890abcdefghij123456 and Authorization: Bearer supersecretjwtvalue12345"
        cleaned = redact_secrets(msg)
        self.assertNotIn("ghp_1234567890", cleaned)
        self.assertNotIn("supersecretjwtvalue12345", cleaned)
        self.assertIn("[REDACTED_SECRET]", cleaned)


if __name__ == "__main__":
    unittest.main()
