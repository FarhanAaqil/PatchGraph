"""NVD CVE API 2.0 enrichment connector (Day 11).

Extracts CVSS v3.1 base score, vector string, and CWE identifier while preserving
source provenance, hash, and staleness indicators. Unknown CVSS stays None (never 0.0).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

NVD_OFFICIAL_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
NVD_PARSER_VERSION = "1.0.0"


@dataclass(frozen=True)
class NvdEnrichmentRecord:
    cve_id: str
    cvss_v3_score: Optional[float]
    cvss_v3_vector: Optional[str]
    cwe: Optional[str]
    source_url: str
    fetched_at: str
    content_sha256: str
    parser_version: str
    stale: bool


class NvdConnector:
    def __init__(self, snapshot_path: Optional[Path] = None, max_age_hours: int = 168) -> None:
        default_path = (
            Path(__file__).resolve().parent.parent.parent.parent / "tests" / "fixtures" / "advisory_snapshot_seed.json"
        )
        self.snapshot_path = snapshot_path or default_path
        self.max_age_hours = max_age_hours

    def enrich_cve(self, cve_id: str, reference_time: Optional[datetime] = None) -> NvdEnrichmentRecord:
        raw = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
        nvd_block = raw["sources"]["nvd"]
        ref_dt = reference_time or datetime(2026, 11, 2, tzinfo=timezone.utc)
        fetched_dt = datetime.fromisoformat(nvd_block["fetched_at"].replace("Z", "+00:00"))
        stale = ((ref_dt - fetched_dt).total_seconds() / 3600.0) > self.max_age_hours

        for rec in nvd_block["records"]:
            if rec["cve_id"] == cve_id:
                score = rec.get("cvss_v3_score")
                if score is not None and not (0.0 <= float(score) <= 10.0):
                    raise ValueError(f"Invalid CVSS score {score} for {cve_id}")
                return NvdEnrichmentRecord(
                    cve_id=cve_id,
                    cvss_v3_score=float(score) if score is not None else None,
                    cvss_v3_vector=rec.get("cvss_v3_vector"),
                    cwe=rec.get("cwe"),
                    source_url=nvd_block["source_url"],
                    fetched_at=nvd_block["fetched_at"],
                    content_sha256=nvd_block["content_sha256"],
                    parser_version=NVD_PARSER_VERSION,
                    stale=stale,
                )

        # Unknown CVSS stays None so downstream scoring applies explicit uncertainty penalty
        return NvdEnrichmentRecord(
            cve_id=cve_id,
            cvss_v3_score=None,
            cvss_v3_vector=None,
            cwe=None,
            source_url=nvd_block["source_url"],
            fetched_at=nvd_block["fetched_at"],
            content_sha256=nvd_block["content_sha256"],
            parser_version=NVD_PARSER_VERSION,
            stale=stale,
        )
