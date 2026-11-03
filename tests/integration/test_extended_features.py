"""Integration Suite for Extended Capabilities (`tests/integration/test_extended_features.py`).

Tests:
1. Human-Gated Patch & Git PR Bundle Generator (verifying unapproved plans are blocked and approved plans emit valid diffs & rollback scripts)
2. Defensive Static AST Source Scanner & Call-Graph Reachability Analyzer
3. Pre-Upgrade Compatibility & Contract Smoke Verification Runner
4. 2-Layer GNN Message-Passing Stretch Ablation
5. Neo4j Cypher Exporter, In-Process Full-Text Search Index, and Pluggable Threat Feed Adapter
"""
from __future__ import annotations

import unittest

from backend.app.catalog.search_index import SupplyChainSearchIndex
from backend.app.connectors.threat_feed_adapter import normalize_custom_threat_feed
from backend.app.db.session import DatabaseManager
from backend.app.graph.build import build_project_supply_chain_graph
from backend.app.graph.neo4j_export import export_graph_to_cypher
from backend.app.ingest.static_scanner import scan_python_source_ast
from backend.app.planner.patch_generator import generate_approved_patch_bundle
from backend.app.planner.test_runner import verify_candidate_upgrade_compatibility
from intelligence.risk.gnn_ablation import run_gnn_message_passing_ablation


class TestExtendedCapabilitiesSuite(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        self.project_id = "00000000-0000-0000-0000-000000000001"
        self.approver_id = "00000000-0000-0000-0000-000000000010"

    def test_human_gated_patch_bundle_generator(self) -> None:
        # Before human approval, generating a patch bundle must raise PermissionError
        with self.assertRaises(PermissionError):
            generate_approved_patch_bundle(self.db, self.project_id, "plan_01")

        # Record human approval in plan_decisions
        self.db.conn.execute(
            "INSERT INTO plan_decisions (id, planning_run_id, user_id, decision, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("dec_ext_01", "plan_01", self.approver_id, "approved", "Approved for PR bundle generation", "2026-11-02T00:00:00Z"),
        )
        self.db.conn.commit()

        bundle = generate_approved_patch_bundle(self.db, self.project_id, "plan_01")
        self.assertIn("-example-lib==1.4.0", bundle.unified_diff)
        self.assertIn("+example-lib==1.4.3", bundle.unified_diff)
        self.assertIn("pip install 'example-lib==1.4.0'", bundle.rollback_script)
        self.assertEqual(len(bundle.bundle_sha256), 64)

    def test_defensive_static_ast_scanner_and_call_graph_reachability(self) -> None:
        sample_py = (
            "import pickle\n"
            "import example_lib\n"
            "def handle_token(raw):\n"
            "    data = pickle.loads(raw)\n"
            "    return example_lib.parse_token(data)\n"
        )
        scan = scan_python_source_ast(sample_py, watched_packages=["example-lib", "urllib3"])
        self.assertTrue(scan.package_reachable["example-lib"])
        self.assertFalse(scan.package_reachable["urllib3"])
        self.assertEqual(len(scan.heuristic_findings), 1)
        self.assertEqual(scan.heuristic_findings[0].cwe, "CWE-502")

    def test_pre_upgrade_compatibility_runner(self) -> None:
        patch_rep = verify_candidate_upgrade_compatibility("example-lib", "1.4.0", "1.4.3")
        self.assertEqual(patch_rep.verdict, "SAFE_TO_ROLLOUT")
        self.assertTrue(patch_rep.smoke_tests_passed)

        major_rep = verify_candidate_upgrade_compatibility("example-lib", "1.4.0", "2.0.0")
        self.assertEqual(major_rep.verdict, "REQUIRES_MIGRATION_HARNESS")
        self.assertFalse(major_rep.abi_symbols_preserved)

    def test_gnn_stretch_ablation_neo4j_export_search_and_custom_feed(self) -> None:
        graph = build_project_supply_chain_graph(self.db, self.project_id)
        gnn_res = run_gnn_message_passing_ablation(graph)
        self.assertFalse(gnn_res["production_authoritative"])
        self.assertIn("pv_example_lib_1_4_0", gnn_res["node_embeddings_scored"])

        cypher = export_graph_to_cypher(graph)
        self.assertIn("MERGE (n:PackageVersion", cypher)
        self.assertIn("DEPENDS_ON", cypher)

        idx = SupplyChainSearchIndex()
        idx.index_document("f1", {"id": "finding_seed_01", "cve": "CVE-2026-1001", "pkg": "example-lib", "cwe": "CWE-502"})
        hits = idx.search("deserialization cwe 502 example")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["id"], "finding_seed_01")

        custom_feed = normalize_custom_threat_feed(
            "custom-cert-advisories",
            "https://cert.example.org/feed.json",
            [{"cve_id": "CVE-2026-1001", "package": "example-lib", "exploit_maturity_prob": 0.92}],
        )
        self.assertEqual(len(custom_feed["content_sha256"]), 64)
        self.assertEqual(custom_feed["records"][0]["exploit_maturity_prob"], 0.92)


if __name__ == "__main__":
    unittest.main()
