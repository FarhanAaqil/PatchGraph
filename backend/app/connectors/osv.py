"""OSV vulnerability connector with recorded snapshot provenance and range matching (Day 10).

Records source URL, fetched_at, content_sha256, and parser_version per 22_Sources_and_Verification_Ledger.md.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.catalog.packages import NormalizedPackageCoord, version_in_range

OSV_OFFICIAL_URL = "https://api.osv.dev/v1/querybatch"
OSV_PARSER_VERSION = "1.0.0"


@dataclass(frozen=True)
class AdvisoryMatch:
    source: str
    external_id: str
    canonical_cve_id: str
    package_name: str
    ecosystem: str
    introduced: str
    fixed: Optional[str]
    summary: str
    source_url: str
    fetched_at: str
    content_sha256: str
    parser_version: str
    stale: bool
    applicability: str  # 'affected' or 'unknown_version'


class OsvConnector:
    """Offline-capable OSV connector backed by content-addressed snapshot fixtures."""

    def __init__(self, snapshot_path: Optional[Path] = None, max_age_hours: int = 168) -> None:
        default_path = (
            Path(__file__).resolve().parent.parent.parent.parent / "tests" / "fixtures" / "advisory_snapshot_seed.json"
        )
        self.snapshot_path = snapshot_path or default_path
        self.max_age_hours = max_age_hours

    def load_osv_source(self, reference_time: Optional[datetime] = None) -> Dict[str, Any]:
        raw = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
        osv_block = dict(raw["sources"]["osv"])
        canonical_payload = json.dumps(osv_block["records"], sort_keys=True).encode("utf-8")
        computed_sha = hashlib.sha256(canonical_payload).hexdigest()
        osv_block["computed_sha256"] = computed_sha

        ref_dt = reference_time or datetime(2026, 11, 2, tzinfo=timezone.utc)
        fetched_dt = datetime.fromisoformat(osv_block["fetched_at"].replace("Z", "+00:00"))
        age_hours = (ref_dt - fetched_dt).total_seconds() / 3600.0
        osv_block["stale"] = age_hours > self.max_age_hours
        return osv_block

    def match_components(
        self,
        components: List[NormalizedPackageCoord],
        reference_time: Optional[datetime] = None,
    ) -> List[AdvisoryMatch]:
        osv_block = self.load_osv_source(reference_time=reference_time)
        matches: List[AdvisoryMatch] = []
        for coord in components:
            for rec in osv_block["records"]:
                if rec["ecosystem"].lower() != coord.ecosystem or rec["package"].lower() != coord.normalized_name:
                    continue
                in_rng = version_in_range(
                    coord.normalized_version,
                    introduced=rec.get("introduced"),
                    fixed=rec.get("fixed"),
                    last_affected=rec.get("last_affected"),
                )
                if in_rng is False:
                    continue
                applicability = "affected" if in_rng is True else "unknown"
                matches.append(
                    AdvisoryMatch(
                        source="osv",
                        external_id=rec["id"],
                        canonical_cve_id=rec["cve_id"],
                        package_name=coord.normalized_name,
                        ecosystem=coord.ecosystem,
                        introduced=rec.get("introduced", "0"),
                        fixed=rec.get("fixed"),
                        summary=rec.get("summary", ""),
                        source_url=osv_block["source_url"],
                        fetched_at=osv_block["fetched_at"],
                        content_sha256=osv_block["content_sha256"],
                        parser_version=OSV_PARSER_VERSION,
                        stale=bool(osv_block["stale"]),
                        applicability=applicability,
                    )
                )
        return matches
