"""Day 56 Final Release Self-Audit Test (`tests/system/test_final_release_gate.py`).

Verifies Gate 8 (Demo Ready) exit criteria and the complete 56-day checklist.
"""

from __future__ import annotations

import unittest
from pathlib import Path

from scripts.reset_demo import reset_demo_environment

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

REQUIRED_56_DAY_PATHS = [
    "docs/scope.md",
    "docs/user_flow.md",
    "docs/domain.md",
    "docs/adr/001-architecture.md",
    "contracts/openapi.yaml",
    "frontend/src/api/generated.ts",
    "frontend/src/app/App.tsx",
    "frontend/src/styles/tokens.css",
    "backend/migrations/001_core.sql",
    "docs/data_examples.md",
    "tests/fixtures/sbom_cyclonedx_seed.json",
    "tests/integration/test_skeleton.py",
    "backend/app/ingest/sbom.py",
    "backend/app/catalog/packages.py",
    "backend/app/connectors/osv.py",
    "backend/app/connectors/nvd.py",
    "backend/app/connectors/exploitation.py",
    "backend/app/graph/build.py",
    "tests/integration/test_import_flow.py",
    "backend/app/catalog/deployments.py",
    "backend/app/graph/traverse.py",
    "backend/app/graph/impact.py",
    "intelligence/risk/baseline.py",
    "experiments/train_exploit.py",
    "experiments/calibrate.py",
    "reports/calibration.md",
    "tests/integration/test_ranking.py",
    "intelligence/planner/candidates.py",
    "intelligence/planner/compatibility.py",
    "intelligence/planner/effort.py",
    "intelligence/planner/model.py",
    "intelligence/planner/solve.py",
    "intelligence/planner/simulate.py",
    "tests/system/test_vertical_slice.py",
    "backend/app/ingest/vex.py",
    "backend/app/catalog/owners.py",
    "backend/app/graph/features.py",
    "backend/app/risk/batch.py",
    "backend/app/monitoring/drift.py",
    "backend/app/jobs/refresh.py",
    "tests/integration/test_decision_loop.py",
    "backend/app/security/auth.py",
    "backend/app/security/policy.py",
    "backend/app/security/uploads.py",
    "tests/security/test_uploads.py",
    "backend/app/observability.py",
    "backend/app/jobs/recovery.py",
    "docker/compose.prod.yml",
    "tests/system/test_system_gate.py",
    "experiments/manifest.py",
    "experiments/report.py",
    "experiments/run_ranking.py",
    "reports/ranking_results.md",
    "experiments/run_graph.py",
    "reports/graph_results.md",
    "experiments/run_planner.py",
    "reports/planner_results.md",
    "experiments/run_ablations.py",
    "reports/ablations.md",
    "experiments/run_stress.py",
    "reports/result_manifest.json",
    "CHANGELOG.md",
    "scripts/reset_demo.py",
    "docs/figures/architecture_and_evaluation_summary.png",
    "README.md",
    "docs/user_guide.md",
]


class TestPhase8FinalReleaseGate(unittest.TestCase):
    def test_all_56_day_master_checklist_files_exist_and_reset_demo_succeeds(self) -> None:
        for rel in REQUIRED_56_DAY_PATHS:
            p = REPO_ROOT / rel
            self.assertTrue(p.exists(), f"Missing 56-day checklist deliverable: {rel}")
            self.assertGreater(p.stat().st_size, 0, f"Empty file: {rel}")

        demo_state = reset_demo_environment()
        self.assertEqual(demo_state["status"], "DEMO_READY_OFFLINE")
        self.assertEqual(demo_state["tables_initialized"], 26)
        self.assertLess(demo_state["reset_time_ms"], 5000.0)


if __name__ == "__main__":
    unittest.main()
