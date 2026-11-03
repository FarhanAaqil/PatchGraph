"""Day 35 Integration Suite (`tests/integration/test_decision_loop.py`).

Proves Gate 5 (Decision Intelligence) exit criteria:
- OpenVEX validation and non-destructive applicability updates (preserving finding count)
- Service and team ownership routing queues
- Bounded graph centrality computation
- Deterministic batch ranking
- Source freshness & feature drift monitoring
- Idempotent scheduled background refresh with exponential backoff and cached snapshot fallback
"""
from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend.app.catalog.owners import build_owner_routing_queues
from backend.app.db.session import DatabaseManager
from backend.app.graph.build import build_project_supply_chain_graph
from backend.app.graph.features import compute_package_centrality_features
from backend.app.ingest.vex import apply_vex_statements_non_destructively, validate_and_parse_vex
from backend.app.jobs.refresh import ScheduledRefreshManager
from backend.app.monitoring.drift import evaluate_source_freshness_and_drift
from backend.app.risk.batch import score_project_findings_in_batches

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"


class TestPhase5DecisionIntelligenceLoop(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        self.project_id = "00000000-0000-0000-0000-000000000001"

    def test_vex_non_destructive_qualification_and_justification_rules(self) -> None:
        vex_doc = json.loads((FIXTURES_DIR / "vex_openvex_seed.json").read_text(encoding="utf-8"))
        validated = validate_and_parse_vex(vex_doc)
        self.assertEqual(validated.errors, [])
        self.assertEqual(len(validated.statements), 1)

        res = apply_vex_statements_non_destructively(self.db, self.project_id, validated)
        self.assertEqual(res["findings_before"], res["findings_after"])
        self.assertEqual(res["findings_qualified"], 1)

        # Missing justification for not_affected must fail validation
        bad_vex = {
            "statements": [
                {
                    "vulnerability": {"name": "CVE-2026-1001"},
                    "products": [{"@id": "pkg:pypi/example-lib@1.4.0"}],
                    "status": "not_affected",
                }
            ]
        }
        bad_res = validate_and_parse_vex(bad_vex)
        self.assertEqual(len(bad_res.errors), 1)

    def test_owner_routing_centrality_and_batch_ranking(self) -> None:
        queues = build_owner_routing_queues(self.db, self.project_id)
        self.assertIn("payments-team@patchgraph.local", queues)
        self.assertIn("data-team@patchgraph.local", queues)

        graph = build_project_supply_chain_graph(self.db, self.project_id)
        cent = compute_package_centrality_features(graph, "pv_example_lib_1_4_0")
        self.assertGreater(cent["centrality_score"], 0.0)
        self.assertEqual(cent["prod_reached_services"], 1.0)

        batch_scores = score_project_findings_in_batches(self.db, self.project_id, batch_size=1)
        self.assertEqual(len(batch_scores), 2)
        self.assertGreater(batch_scores[0]["final_score"], batch_scores[1]["final_score"])

    def test_drift_detection_and_idempotent_scheduled_refresh(self) -> None:
        cutoffs = {
            "osv": {"fetched_at": "2026-11-01T00:00:00Z", "stale": False},
            "epss": {"fetched_at": "2026-10-25T00:00:00Z", "stale": False},
        }
        drift = evaluate_source_freshness_and_drift(
            cutoffs,
            baseline_epss_samples=[0.05, 0.10, 0.08],
            current_epss_samples=[0.45, 0.55, 0.60],
            reference_time=datetime(2026, 11, 2, tzinfo=timezone.utc),
            max_age_hours=48.0,
        )
        self.assertIn("epss", drift["stale_sources"])
        self.assertTrue(drift["feature_drift_detected"])

        mgr = ScheduledRefreshManager()
        r1 = mgr.run_idempotent_refresh("refresh_2026_11_02", simulate_http_status=429, max_retries=3)
        r2 = mgr.run_idempotent_refresh("refresh_2026_11_02", simulate_http_status=200)
        self.assertEqual(r1.status, "fallback_pinned_snapshot")
        self.assertTrue(r1.used_cached_snapshot)
        self.assertEqual(len(r1.backoff_schedule_seconds), 3)
        # Idempotent call returns exact same record
        self.assertEqual(r1, r2)


if __name__ == "__main__":
    unittest.main()
