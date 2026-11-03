# PatchGraph Analyst & Approver User Guide

## 1. Uploading SBOM and VEX Files
Navigate to `/imports` or `POST /api/v1/imports/sbom` with a CycloneDX 1.4–1.6 or SPDX 2.3 JSON document (capped at 25 MB and nesting depth <= 64). Every upload is hashed with SHA-256 (`content_sha256`); re-uploading an identical document is idempotent.

## 2. Understanding Explainable Risk Scores
Every finding exposes all six terms of the scoring equation:
`w_f = alpha * sev_f + beta * p_hat(exploit_f) + gamma * crit_f + delta * reach_f + epsilon * 1[KEV_f] - lambda * unc_f`.
Missing CVSS or EPSS values never default to zero — they trigger an explicit uncertainty penalty displayed in the UI.

## 3. Simulating and Approving Remediation Plans
Use `/planner` (`POST /api/v1/plans`) to specify `budget_hours`, `max_downtime_minutes`, and `environments`. Compare alternative constraint settings in `/what-if` (`POST /api/v1/plans/{id}/simulate`). Final plan approval (`POST /api/v1/plans/{id}/decision`) requires the `approver` or `admin` role and writes an immutable entry to `audit_logs`.
