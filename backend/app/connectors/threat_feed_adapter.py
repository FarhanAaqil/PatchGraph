"""Pluggable Threat-Intelligence Webhook & Offline Custom Feed Adapter (`backend/app/connectors/threat_feed_adapter.py`).

Allows organizations with custom or commercial threat feeds to normalize external JSON
advisories into PatchGraph's content-addressed `AdvisoryMatch` format while keeping
offline reproducibility via SHA-256 snapshot pinning.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List


def normalize_custom_threat_feed(feed_name: str, source_url: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    canonical = json.dumps(records, sort_keys=True).encode("utf-8")
    sha256_hex = hashlib.sha256(canonical).hexdigest()
    normalized = []
    for r in records:
        epss = float(r.get("exploit_maturity_prob", 0.5))
        if not (0.0 <= epss <= 1.0):
            raise ValueError("exploit_maturity_prob must be in [0, 1]")
        normalized.append(
            {
                "feed_name": feed_name,
                "cve_id": r["cve_id"],
                "package": r["package"].lower(),
                "ecosystem": r.get("ecosystem", "pypi").lower(),
                "exploit_maturity_prob": epss,
                "content_sha256": sha256_hex,
                "source_url": source_url,
            }
        )
    return {"feed_name": feed_name, "content_sha256": sha256_hex, "records": normalized}
