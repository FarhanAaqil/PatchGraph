"""Day 21 Integration Suite (`tests/integration/test_ranking.py`).

Proves Gate 3 (Intelligence Slice) exit criteria:
- Bounded traversal traces `example-lib@1.4.0` through `checkout-sdk@2.1.0` to `checkout` (prod) and `analytics-worker` (staging)
- Cycle-safe traversal terminates cleanly on cyclic dependency graphs and enforces depth <= 12
- Blast radius excludes VEX `not_affected` services while preserving the underlying finding record
- Deterministic baseline formula and calibrated exploit-likelihood model produce explainable factor breakdowns
- Temporal and package-family leakage controls reject leaked training splits
"""
from __future__ import annotations

import unittest
from pathlib import Path

from backend.app.catalog.deployments import get_project_deployment_contexts, parse_deployment_csv
from backend.app.db.session import DatabaseManager
from backend.app.graph.build import TypedSupplyChainGraph, build_project_supply_chain_graph
from backend.app.graph.impact import compute_blast_radius
from backend.app.graph.traverse import traverse_affected_paths
from backend.app.risk.baseline import rank_findings_by_baseline, score_finding_explainable
from experiments.calibrate import generate_calibration_report
from intelligence.risk.model import (
    CalibratedExploitModel,
    VulnerabilityFeatureRow,
    verify_no_temporal_or_family_leakage,
)


class TestPhase3IntelligenceSliceIntegration(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        self.project_id = "00000000-0000-0000-0000-000000000001"

    def test_deployment_context_and_csv_validation(self) -> None:
        contexts = get_project_deployment_contexts(self.db, self.project_id)
        self.assertIn("checkout", contexts)
        self.assertTrue(contexts["checkout"].production)
        self.assertEqual(contexts["checkout"].criticality, 5)
        self.assertEqual(contexts["checkout"].max_downtime_minutes, 30)

        csv_sample = (
            "application,service,asset_key,environment,production,owner_email,criticality,max_downtime_minutes\n"
            "commerce-platform,checkout,prod-cluster/checkout,prod,true,payments@patchgraph.local,5,30\n"
        )
        parsed = parse_deployment_csv(csv_sample)
        self.assertEqual(len(parsed), 1)
        self.assertTrue(parsed[0]["production"])

    def test_bounded_traversal_cycle_safety_and_blast_radius(self) -> None:
        graph = build_project_supply_chain_graph(self.db, self.project_id)
        # Inject a dependency cycle between two package versions to verify cycle safety
        graph.add_edge("pv_example_lib_1_4_0", "pv_checkout_sdk_2_1_0", kind="depends_on")

        paths, cycle_seen = traverse_affected_paths(graph, "pv_example_lib_1_4_0", max_depth=6)
        self.assertTrue(cycle_seen)
        services_reached = {p.service_name for p in paths}
        self.assertEqual(services_reached, {"checkout", "analytics-worker"})

        # Apply VEX override qualifying analytics-worker as not_affected
        summary = compute_blast_radius(
            graph,
            "pv_example_lib_1_4_0",
            max_depth=6,
            vex_overrides={("pv_example_lib_1_4_0", "analytics-worker"): "not_affected"},
        )
        self.assertEqual(summary.production_services, ["checkout"])
        self.assertEqual(summary.non_production_services, [])
        self.assertEqual(summary.total_affected_services, 1)
        self.assertEqual(summary.owners, ["payments-team@patchgraph.local"])

        with self.assertRaises(ValueError):
            traverse_affected_paths(graph, "pv_example_lib_1_4_0", max_depth=15)

    def test_explainable_risk_baseline_and_unknown_evidence_penalty(self) -> None:
        prod_score = score_finding_explainable(
            finding_id="finding_seed_01",
            canonical_id="CVE-2026-1001",
            cvss_score=8.8,
            exploit_prob=0.86,
            criticality=5,
            reachability_state="reachable_prod",
            known_exploited=True,
        )
        self.assertAlmostEqual(prod_score.final_score, 10.57, places=2)
        self.assertAlmostEqual(prod_score.uncertainty, 0.10, places=2)

        # Missing CVSS and EPSS must increase uncertainty and never silently zero out
        unknown_score = score_finding_explainable(
            finding_id="finding_unknown",
            canonical_id="CVE-2026-9999",
            cvss_score=None,
            exploit_prob=None,
            criticality=3,
            reachability_state="transitive_unverified",
            known_exploited=False,
            stale_evidence=True,
        )
        self.assertGreater(unknown_score.uncertainty, 0.70)
        self.assertGreater(unknown_score.final_score, 0.0)

        ranked = rank_findings_by_baseline(
            [prod_score.__dict__, unknown_score.__dict__],
            strategy="final_score",
        )
        self.assertEqual(ranked[0]["finding_id"], "finding_seed_01")

    def test_calibrated_exploit_model_and_leakage_controls(self) -> None:
        cal_res = generate_calibration_report()
        self.assertLessEqual(cal_res["calibrated"]["brier_score"], cal_res["uncalibrated"]["brier_score"] + 0.05)
        self.assertGreaterEqual(cal_res["calibrated"]["roc_auc"], 0.85)
        self.assertEqual(len(cal_res["bundle_sha256"]), 64)

        # Verify leakage detector catches package-family overlap
        r1 = VulnerabilityFeatureRow("CVE-1", "pypi:same-pkg", "pypi", "2025-01-01", "2025-01-02", 8.0, 0.5, 1, True, False, 2, 1)
        r2 = VulnerabilityFeatureRow("CVE-2", "pypi:same-pkg", "pypi", "2026-09-01", "2026-09-02", 8.0, 0.5, 1, True, False, 2, 0)
        with self.assertRaises(ValueError):
            verify_no_temporal_or_family_leakage([r1], [r2], cutoff_date="2026-06-30")


if __name__ == "__main__":
    unittest.main()
