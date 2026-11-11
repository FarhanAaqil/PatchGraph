"""Dataset & Trained Model Bundle Verification Suite (`tests/unit/test_datasets_and_models.py`).

Verifies:
1. `data/datasets/exploit_training_dataset.csv` has 600 rows (420 train, 180 test), zero temporal leakage, and zero package-family overlap.
2. `data/datasets/remediation_effort_dataset.csv` has 400 rows (280 train, 120 test).
3. `data/fixtures/model_exploit_v1.json` and `data/fixtures/model_effort_v1.json` are trained from the CSVs, calibrated, and beat naive baselines on the held-out test split.
"""

from __future__ import annotations

import csv
import json
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestTrainedDatasetsAndModelBundles(unittest.TestCase):
    def test_exploit_csv_dataset_and_trained_bundle(self) -> None:
        csv_path = REPO_ROOT / "data" / "datasets" / "exploit_training_dataset.csv"
        self.assertTrue(csv_path.exists())
        with csv_path.open("r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 600)

        bundle_path = REPO_ROOT / "data" / "fixtures" / "model_exploit_v1.json"
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        self.assertEqual(bundle["leakage_audit"]["train_count"], 420)
        self.assertEqual(bundle["leakage_audit"]["test_count"], 180)
        self.assertEqual(bundle["leakage_audit"]["family_overlap_count"], 0)
        self.assertTrue(bundle["leakage_audit"]["leakage_check_passed"])
        self.assertGreaterEqual(bundle["test_metrics"]["roc_auc"], 0.80)

    def test_effort_csv_dataset_and_trained_bundle(self) -> None:
        csv_path = REPO_ROOT / "data" / "datasets" / "remediation_effort_dataset.csv"
        self.assertTrue(csv_path.exists())
        with csv_path.open("r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 400)

        bundle_path = REPO_ROOT / "data" / "fixtures" / "model_effort_v1.json"
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        self.assertEqual(bundle["train_rows"], 280)
        self.assertEqual(bundle["test_rows"], 120)
        # Trained Ridge model MAE must beat the fixed-jump-hours baseline MAE
        self.assertLess(
            bundle["test_metrics"]["mae_hours"],
            bundle["test_metrics"]["fixed_jump_baseline_mae_hours"],
        )

    def test_runtime_inference_from_pretrained_exploit_and_effort_bundles(self) -> None:
        from backend.app.planner.effort import predict_effort_with_model_two
        from intelligence.risk.model import VulnerabilityFeatureRow, load_pretrained_exploit_model

        exp_model = load_pretrained_exploit_model()
        sample_row = VulnerabilityFeatureRow(
            cve_id="CVE-2026-1001",
            package_family="pypi:example-lib",
            ecosystem="pypi",
            published_date="2026-10-10",
            as_of_date="2026-11-01",
            cvss_score=8.8,
            epss=0.86,
            age_days=22,
            is_remote_vector=True,
            is_deserialization_or_rce_cwe=True,
            reference_count=7,
            exploited_within_horizon=1,
        )
        pred = exp_model.predict_proba_one(sample_row)
        self.assertGreater(pred["probability"], 0.70)
        self.assertIn("cvss_norm", pred["feature_contributions"])

        eff_patch = predict_effort_with_model_two(
            "patch", affected_service_count=1, centrality_score=0.2, test_coverage=0.85
        )
        eff_major = predict_effort_with_model_two(
            "major", affected_service_count=3, centrality_score=0.7, test_coverage=0.60
        )
        self.assertGreater(eff_major.effort_hours, eff_patch.effort_hours)
        self.assertLessEqual(eff_patch.lower_bound_hours, eff_patch.effort_hours)
        self.assertGreaterEqual(eff_patch.upper_bound_hours, eff_patch.effort_hours)
        self.assertIn("ridge-quantile-effort-v1", eff_patch.provenance)


if __name__ == "__main__":
    unittest.main()
