"""Input hardening for untrusted SBOM/VEX uploads and secret redaction (Day 38).

Enforces:
- Allowlisted media types (`application/json`, `application/vnd.cyclonedx+json`, `application/spdx+json`)
- 25 MB maximum payload size
- Maximum JSON nesting depth <= 64
- Maximum JSON node/element count <= 100,000
- Non-executing parser and HTML/script tag rejection in identifiers
- Secret redaction on logs and snapshots
"""

from __future__ import annotations

import json
import re
from typing import Any, Tuple

ALLOWED_UPLOAD_MEDIA_TYPES = {
    "application/json",
    "application/vnd.cyclonedx+json",
    "application/spdx+json",
    "application/openvex+json",
}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_NESTING_DEPTH = 64
MAX_TOTAL_NODES = 100_000

SECRET_PATTERNS = [
    re.compile(r"(ghp_[A-Za-z0-9]{20,})"),
    re.compile(r"(Bearer\s+[A-Za-z0-9._\-]{16,})", re.I),
    re.compile(r"((?:api_key|secret|password|token)\s*[:=]\s*['\"]?[A-Za-z0-9._\-]{8,}['\"]?)", re.I),
]
SCRIPT_INJECTION_RE = re.compile(r"<\s*script\b|javascript:", re.I)


def redact_secrets(text: str) -> str:
    redacted = text
    for pat in SECRET_PATTERNS:
        redacted = pat.sub("[REDACTED_SECRET]", redacted)
    return redacted


def _inspect_json_tree(obj: Any, depth: int = 0) -> Tuple[int, int, bool]:
    """Return `(max_depth, node_count, injection_found)`."""
    if depth > MAX_NESTING_DEPTH:
        return depth, 1, False
    if isinstance(obj, dict):
        max_d = depth + 1
        total_n = 1
        inj = False
        for k, v in obj.items():
            if isinstance(k, str) and SCRIPT_INJECTION_RE.search(k):
                inj = True
            d, n, child_inj = _inspect_json_tree(v, depth + 1)
            max_d = max(max_d, d)
            total_n += n
            inj = inj or child_inj
            if total_n > MAX_TOTAL_NODES:
                break
        return max_d, total_n, inj
    if isinstance(obj, list):
        max_d = depth + 1
        total_n = 1
        inj = False
        for item in obj:
            d, n, child_inj = _inspect_json_tree(item, depth + 1)
            max_d = max(max_d, d)
            total_n += n
            inj = inj or child_inj
            if total_n > MAX_TOTAL_NODES:
                break
        return max_d, total_n, inj
    if isinstance(obj, str):
        return depth, 1, bool(SCRIPT_INJECTION_RE.search(obj))
    return depth, 1, False


def validate_untrusted_upload(
    raw_bytes: bytes,
    content_type: str = "application/json",
) -> Any:
    media_type = (content_type or "").split(";")[0].strip().lower()
    if media_type not in ALLOWED_UPLOAD_MEDIA_TYPES:
        raise ValueError(f"Unsupported media type '{media_type}'")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError(f"Upload size {len(raw_bytes)} exceeds 25 MB cap ({MAX_UPLOAD_BYTES} bytes)")
    parsed = json.loads(raw_bytes.decode("utf-8"))
    max_d, total_nodes, has_injection = _inspect_json_tree(parsed)
    if max_d > MAX_NESTING_DEPTH:
        raise ValueError(f"JSON nesting depth {max_d} exceeds limit {MAX_NESTING_DEPTH}")
    if total_nodes > MAX_TOTAL_NODES:
        raise ValueError(f"JSON node count {total_nodes} exceeds limit {MAX_TOTAL_NODES}")
    if has_injection:
        raise ValueError("Untrusted upload contains disallowed script/URI injection payload")
    return parsed
