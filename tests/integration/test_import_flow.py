"""Day 14 Integration Suite (`tests/integration/test_import_flow.py`).

Proves Gate 2 (Data Flow) exit criteria:
- CycloneDX 1.5 and SPDX 2.3 SBOM validation, duplicate edge collapsing, and location-specific errors
- Canonical package ecosystem, PEP 503 name, version, and PURL normalization
- OSV, NVD CVE 2.0, FIRST EPSS, and CISA KEV enrichment from recorded fixtures with SHA-256 provenance
- Explicit staleness flagging when reference time exceeds freshness window
- Typed dependency graph persistence and projection
"""
from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend.app.catalog.packages import (
    normalize_package_name,
    parse_and_normalize_purl,
    version_in_range,
)
from backend.app.connectors.exploitation import ExploitationConnector
from backend.app.connectors.nvd import NvdConnector
from backend.app.connectors.osv import OsvConnector
from backend.app.db.session import DatabaseManager
from backend.app.graph.build import build_project_supply_chain_graph, persist_validated_sbom_graph
from backend.app.ingest.sbom import validate_and_parse_sbom

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"


class TestPhase2DataFlowIntegration(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        self.project_id = "00000000-0000-0000-0000-000000000001"

    def test_package_and_purl_normalization_and_version_ranges(self) -> None:
        self.assertEqual(normalize_package_name("pypi", "Example_Lib.Core"), "example-lib-core")
        coord = parse_and_normalize_purl("pkg:pypi/Example_Lib@v1.4.0")
        self.assertEqual(coord.ecosystem, "pypi")
        self.assertEqual(coord.normalized_name, "example-lib")
        self.assertEqual(coord.normalized_version, "1.4.0")
        self.assertEqual(coord.purl, "pkg:pypi/example-lib@1.4.0")

        self.assertTrue(version_in_range("1.4.0", introduced="1.0.0", fixed="1.4.3"))
        self.assertFalse(version_in_range("1.4.3", introduced="1.0.0", fixed="1.4.3"))
        self.assertIsNone(version_in_range("unparseable-git-hash", introduced="1.0.0", fixed="1.4.3"))

    def test_cyclonedx_and_spdx_ingestion_and_duplicate_edge_collapsing(self) -> None:
        cdx_doc = json.loads((FIXTURES_DIR / "sbom_cyclonedx_seed.json").read_text(encoding="utf-8"))
        # Inject a duplicate edge to verify collapsing with provenance
        cdx_doc["dependencies"][1]["dependsOn"].append("pkg:pypi/example-lib@1.4.0")
        validated = validate_and_parse_sbom("cyclonedx", cdx_doc)
        self.assertEqual(validated.errors, [])
        self.assertEqual(len(validated.components), 3)
        self.assertEqual(len(validated.edges), 2)
        self.assertEqual(validated.collapsed_duplicate_edges, 1)

        spdx_doc = json.loads((FIXTURES_DIR / "sbom_spdx_seed.json").read_text(encoding="utf-8"))
        validated_spdx = validate_and_parse_sbom("spdx", spdx_doc)
        self.assertEqual(validated_spdx.errors, [])
        self.assertEqual(len(validated_spdx.components), 2)
        self.assertEqual(len(validated_spdx.edges), 1)

        # Verify field-level validation errors on broken references
        broken_cdx = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.5",
            "components": [{"name": "missing-version-pkg"}],
            "dependencies": [{"ref": "pkg:pypi/nonexistent@1.0.0", "dependsOn": []}],
        }
        invalid_res = validate_and_parse_sbom("cyclonedx", broken_cdx)
        self.assertEqual(len(invalid_res.errors), 2)
        self.assertEqual(invalid_res.errors[0]["location"], "$.components[0].version")
        self.assertEqual(invalid_res.errors[1]["location"], "$.dependencies[0].ref")

    def test_osv_nvd_epss_kev_enrichment_and_staleness_detection(self) -> None:
        cdx_doc = json.loads((FIXTURES_DIR / "sbom_cyclonedx_seed.json").read_text(encoding="utf-8"))
        validated = validate_and_parse_sbom("cyclonedx", cdx_doc)

        osv = OsvConnector()
        fresh_time = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
        stale_time = datetime(2026, 11, 20, 0, 0, tzinfo=timezone.utc)

        matches_fresh = osv.match_components(list(validated.components.values()), reference_time=fresh_time)
        self.assertEqual(len(matches_fresh), 2)
        cve_ids = {m.canonical_cve_id for m in matches_fresh}
        self.assertEqual(cve_ids, {"CVE-2026-1001", "CVE-2023-45803"})
        self.assertFalse(matches_fresh[0].stale)
        self.assertEqual(len(matches_fresh[0].content_sha256), 64)

        matches_stale = osv.match_components(list(validated.components.values()), reference_time=stale_time)
        self.assertTrue(matches_stale[0].stale)

        nvd = NvdConnector()
        nvd_rec = nvd.enrich_cve("CVE-2026-1001", reference_time=fresh_time)
        self.assertAlmostEqual(nvd_rec.cvss_v3_score or 0.0, 8.8)
        self.assertEqual(nvd_rec.cwe, "CWE-502")
        self.assertFalse(nvd_rec.stale)

        # Missing CVE in NVD must keep cvss_v3_score as None (never silent 0.0)
        nvd_unknown = nvd.enrich_cve("CVE-2099-9999", reference_time=fresh_time)
        self.assertIsNone(nvd_unknown.cvss_v3_score)

        expl = ExploitationConnector()
        expl_rec = expl.fetch_exploitation_evidence("CVE-2026-1001", reference_time=fresh_time)
        self.assertAlmostEqual(expl_rec.epss or 0.0, 0.86)
        self.assertTrue(expl_rec.known_exploited)
        self.assertFalse(expl_rec.stale)

        expl_stale = expl.fetch_exploitation_evidence("CVE-2026-1001", reference_time=stale_time)
        self.assertTrue(expl_stale.stale)

    def test_persist_and_build_typed_supply_chain_graph(self) -> None:
        cdx_doc = json.loads((FIXTURES_DIR / "sbom_cyclonedx_seed.json").read_text(encoding="utf-8"))
        validated = validate_and_parse_sbom("cyclonedx", cdx_doc)
        stats = persist_validated_sbom_graph(self.db, self.project_id, "imp_seed_sbom_01", validated)
        self.assertGreaterEqual(stats["collapsed_duplicate_edges"], 0)

        graph = build_project_supply_chain_graph(self.db, self.project_id)
        self.assertGreaterEqual(graph.number_of_nodes(), 9)
        self.assertGreaterEqual(graph.number_of_edges(), 9)
        self.assertEqual(graph.nodes["pv_example_lib_1_4_0"]["kind"], "package_version")
        self.assertEqual(graph.nodes["service:checkout"]["kind"], "service")


if __name__ == "__main__":
    unittest.main()
