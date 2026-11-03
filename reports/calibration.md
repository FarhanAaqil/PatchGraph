# PatchGraph Model One (Exploit Likelihood) Calibration Report

- **Model Version**: `calibrated-logreg-v1`
- **Bundle SHA-256**: `9bacd34146b27b92d59a9ad0303d60a4b2e6540952788d37a83393a1cb6a039e`
- **Temporal Cutoff Date**: `2026-06-30` (Train `n=420`, Post-Cutoff Test `n=180`, Package-Family Overlap `0`)

## 1. Calibration & Discrimination Comparison (Post-Cutoff Test Set)

| Metric | Uncalibrated Logistic Regression | Platt-Calibrated Logistic Regression |
|---|---:|---:|
| **Brier Score** (lower is better) | 0.1365 | 0.1194 |
| **Expected Calibration Error (ECE)** | 0.1273 | 0.0389 |
| **PR-AUC** | 0.9482 | 0.9482 |
| **ROC-AUC** | 0.9053 | 0.9053 |

## 2. Reliability Curve Bins (Calibrated Model)

| Probability Bin | Count | Mean Predicted Probability | Observed Exploitation Rate |
|---|---:|---:|---:|
| `[0.00, 0.33]` | 47 | 0.2388 | 0.2128 |
| `[0.33, 0.67]` | 44 | 0.5163 | 0.4773 |
| `[0.67, 1.00]` | 89 | 0.9207 | 0.9663 |

## 3. Documented Limitations
- Small capstone sample sizes introduce variance in tail reliability bins; uncertainty bands remain mandatory on all analyst-facing views.
- Post-disclosure advisory edits are excluded via frozen `as_of_date` snapshots.
