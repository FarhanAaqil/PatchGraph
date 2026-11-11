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
    "frontend/src/content/terms.ts",
    "docs/adr/001-architecture.md",
    "frontend/src/app/routes.tsx",
    "contracts/openapi.yaml",
    "frontend/src/api/generated.ts",
    "backend/migrations/001_core.sql",
    "docs/data_examples.md",
    "tests/fixtures/sbom_cyclonedx_seed.json",
    "frontend/src/pages/Imports.tsx",
    "tests/integration/test_skeleton.py",
    "tests/e2e/skeleton.spec.ts",
    "backend/app/ingest/sbom.py",
    "frontend/src/components/ImportErrors.tsx",
    "backend/app/catalog/packages.py",
    "frontend/src/pages/Packages.tsx",
    "backend/app/connectors/osv.py",
    "frontend/src/components/SourceBadge.tsx",
    "backend/app/connectors/nvd.py",
    "frontend/src/components/CvssPanel.tsx",
    "backend/app/connectors/exploitation.py",
    "frontend/src/components/ExploitEvidence.tsx",
    "backend/app/graph/build.py",
    "frontend/src/pages/DependencyGraph.tsx",
    "tests/integration/test_import_flow.py",
    "tests/e2e/import-flow.spec.ts",
    "backend/app/catalog/deployments.py",
    "frontend/src/pages/Assets.tsx",
    "backend/app/graph/traverse.py",
    "frontend/src/components/PathExplorer.tsx",
    "backend/app/graph/impact.py",
    "frontend/src/pages/BlastRadius.tsx",
    "intelligence/risk/baseline.py",
    "frontend/src/components/RiskFactors.tsx",
    "experiments/train_exploit.py",
    "frontend/src/components/ModelCard.tsx",
    "experiments/calibrate.py",
    "reports/calibration.md",
    "tests/integration/test_ranking.py",
    "tests/e2e/ranking.spec.ts",
    "intelligence/planner/candidates.py",
    "frontend/src/components/PatchCandidates.tsx",
    "intelligence/planner/compatibility.py",
    "frontend/src/components/Compatibility.tsx",
    "intelligence/planner/effort.py",
    "frontend/src/components/EffortEditor.tsx",
    "intelligence/planner/model.py",
    "frontend/src/components/PlanConstraints.tsx",
    "intelligence/planner/solve.py",
    "frontend/src/components/SolverDiagnostics.tsx",
    "intelligence/planner/simulate.py",
    "frontend/src/pages/WhatIf.tsx",
    "tests/system/test_vertical_slice.py",
    "tests/e2e/vertical-slice.spec.ts",
    "backend/app/ingest/vex.py",
    "frontend/src/pages/VexImports.tsx",
    "backend/app/catalog/owners.py",
    "frontend/src/pages/OwnerQueue.tsx",
    "backend/app/graph/features.py",
    "frontend/src/components/CentralityHelp.tsx",
    "backend/app/risk/batch.py",
    "frontend/src/pages/Prioritization.tsx",
    "backend/app/monitoring/drift.py",
    "frontend/src/pages/DataHealth.tsx",
    "backend/app/jobs/refresh.py",
    "frontend/src/pages/Jobs.tsx",
    "tests/integration/test_decision_loop.py",
    "tests/e2e/decision-loop.spec.ts",
    "backend/app/security/auth.py",
    "frontend/src/auth/session.ts",
    "backend/app/security/policy.py",
    "tests/e2e/access-control.spec.ts",
    "backend/app/security/uploads.py",
    "tests/security/test_uploads.py",
    "backend/app/observability.py",
    "frontend/src/pages/SystemHealth.tsx",
    "backend/app/jobs/recovery.py",
    "frontend/src/components/RecoveryActions.tsx",
    "docker/compose.prod.yml",
    "frontend/src/config/runtime.ts",
    "tests/system/test_system_gate.py",
    "tests/e2e/system-gate.spec.ts",
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
    "tests/e2e/stress.spec.ts",
    "reports/result_manifest.json",
    "docs/claim_evidence_map.md",
    "CHANGELOG.md",
    "frontend/src/content/release.ts",
    "scripts/reset_demo.py",
    "docs/demo/operator_script.md",
    "docs/figures/architecture_and_evaluation_summary.png",
    "docs/presentation/outline.md",
    "README.md",
    "docs/user_guide.md",
    "docs/demo/timing_log.md",
    "docs/demo/usability_log.md",
    "docs/demo/fallback_runbook.md",
    "docs/demo/backup_assets/approved_plan_01_export.json",
    "release/final_checklist.md",
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
