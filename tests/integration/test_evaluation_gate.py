"""Day 49 Gate 7 Suite (`tests/integration/test_evaluation_gate.py`).

Executes ranking, graph, planner, ablation, and stress evaluations and writes
`reports/result_manifest.json`.
"""

from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from experiments.run_ablations import run_ablation_suite
from experiments.run_graph import run_graph_evaluation
from experiments.run_planner import run_planner_evaluation
from experiments.run_ranking import run_ranking_evaluation
from experiments.run_stress import run_stress_benchmark

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestPhase7EvidenceReadyGate(unittest.TestCase):
    def test_full_evaluation_ablations_and_stress_suite(self) -> None:
        rank_res = run_ranking_evaluation()
        graph_res = run_graph_evaluation()
        plan_res = run_planner_evaluation()
        abl_res = run_ablation_suite()
        stress_res = run_stress_benchmark(num_edges=2500, num_queries=15)

        # Verify RQ1: PatchGraph deployment-aware NDCG@6 beats CVSS-descending
        pg_ndcg = rank_res["strategies"]["patchgraph_deployment_aware"]["ndcg_at_6"]
        cvss_ndcg = rank_res["strategies"]["cvss_descending"]["ndcg_at_6"]
        self.assertGreater(pg_ndcg, cvss_ndcg)

        # Verify RQ2: CP-SAT exposure removed beats greedy risk-descending under 10h budget
        self.assertGreater(
            plan_res["cpsat_optimal"]["risk_removed"],
            plan_res["greedy_risk_descending"]["risk_removed"],
        )

        # Verify RQ3: Incomplete inventory recall >= 0.80
        self.assertGreaterEqual(graph_res["incomplete_inventory_85pct"]["recall"], 0.80)

        # Verify stress p95 < 2000 ms
        self.assertTrue(stress_res["passes_latency_target"])

        manifest_payload = {
            "gate": "Gate 7 — Evidence Ready",
            "ranking": rank_res,
            "graph": graph_res,
            "planner": plan_res,
            "ablations": abl_res,
            "stress": stress_res,
        }
        manifest_bytes = json.dumps(manifest_payload, indent=2, sort_keys=True).encode("utf-8")
        manifest_payload["result_manifest_sha256"] = hashlib.sha256(manifest_bytes).hexdigest()

        out_path = REPO_ROOT / "reports" / "result_manifest.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
        self.assertTrue(out_path.exists())


if __name__ == "__main__":
    unittest.main()
