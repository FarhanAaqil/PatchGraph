"""Model Calibration & Reliability Report Generator (Day 20)."""
from __future__ import annotations

import json
from pathlib import Path

from experiments.train_exploit import build_time_split_dataset, run_training
from intelligence.risk.model import CalibratedExploitModel, _sigmoid, compute_binary_classification_metrics, extract_feature_vector
import numpy as np


def generate_calibration_report() -> dict:
    repo_root = Path(__file__).resolve().parent.parent
    bundle_path = repo_root / "data" / "fixtures" / "model_exploit_v1.json"
    bundle = run_training(bundle_path)
    train_rows, test_rows, cutoff = build_time_split_dataset()
    model = CalibratedExploitModel.from_bundle_dict(bundle)

    X_test = np.vstack([extract_feature_vector(r) for r in test_rows])
    y_test = np.array([r.exploited_within_horizon for r in test_rows], dtype=np.float64)

    uncalibrated_probs = _sigmoid(X_test @ model.weights + model.bias)
    calibrated_probs = model.predict_proba(test_rows)

    uncal_metrics = compute_binary_classification_metrics(y_test, uncalibrated_probs, n_bins=3)
    cal_metrics = compute_binary_classification_metrics(y_test, calibrated_probs, n_bins=3)

    report_md = f"""# PatchGraph Model One (Exploit Likelihood) Calibration Report

- **Model Version**: `{bundle['model_version']}`
- **Bundle SHA-256**: `{bundle['bundle_sha256']}`
- **Temporal Cutoff Date**: `{cutoff}` (Train `n={len(train_rows)}`, Post-Cutoff Test `n={len(test_rows)}`, Package-Family Overlap `0`)

## 1. Calibration & Discrimination Comparison (Post-Cutoff Test Set)

| Metric | Uncalibrated Logistic Regression | Platt-Calibrated Logistic Regression |
|---|---:|---:|
| **Brier Score** (lower is better) | {uncal_metrics['brier_score']:.4f} | {cal_metrics['brier_score']:.4f} |
| **Expected Calibration Error (ECE)** | {uncal_metrics['ece']:.4f} | {cal_metrics['ece']:.4f} |
| **PR-AUC** | {uncal_metrics['pr_auc']:.4f} | {cal_metrics['pr_auc']:.4f} |
| **ROC-AUC** | {uncal_metrics['roc_auc']:.4f} | {cal_metrics['roc_auc']:.4f} |

## 2. Reliability Curve Bins (Calibrated Model)

| Probability Bin | Count | Mean Predicted Probability | Observed Exploitation Rate |
|---|---:|---:|---:|\n"""
    for b in cal_metrics["reliability_bins"]:
        report_md += f"| `{b['bin']}` | {b['count']} | {b['mean_predicted_prob']:.4f} | {b['observed_positive_rate']:.4f} |\n"

    report_md += """
## 3. Documented Limitations
- Small capstone sample sizes introduce variance in tail reliability bins; uncertainty bands remain mandatory on all analyst-facing views.
- Post-disclosure advisory edits are excluded via frozen `as_of_date` snapshots.
"""
    report_path = repo_root / "reports" / "calibration.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report_md, encoding="utf-8")
    return {"uncalibrated": uncal_metrics, "calibrated": cal_metrics, "bundle_sha256": bundle["bundle_sha256"]}


if __name__ == "__main__":
    generate_calibration_report()
