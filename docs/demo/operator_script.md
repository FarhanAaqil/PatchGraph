# PatchGraph Live Demo Operator Script (< 10 Minutes, Offline-First)

## Pre-Demo Reset (0:00 – 0:45)
1. Run `python3 scripts/reset_demo.py` to reset the local database and verify pinned snapshot `snap_01` (`9f86d081...`).
2. Confirm the top banner displays `[OFFLINE-DEMO] Offline Reproducible Demo Mode`.

## Step 1 — Ingest SBOM & VEX with Validation (0:45 – 2:30)
1. Open **SBOM and VEX Imports** (`/imports`).
2. Load `sbom_cyclonedx_seed.json` (`commerce-platform`) and show the content-addressed SHA-256 digest (`4a7d1ed4...`).
3. Load `vex_openvex_seed.json` qualifying `CVE-2026-1001` as `not_affected` on `analytics-worker` (`vulnerable_code_not_in_execute_path`) while preserving the match in the inventory.

## Step 2 — Trace Blast Radius & Inspect Explainable Risk Factors (2:30 – 5:00)
1. Open **Prioritization** (`/prioritization`) and select `finding_seed_01` (`example-lib@1.4.0` in `checkout` prod).
2. Inspect the factor breakdown: Severity (`+3.52`), Calibrated Exploit Probability (`+2.15`, `p=0.86`), Asset Criticality (`+2.00`), Reachability (`+1.50`), CISA KEV Bonus (`+1.50`), and Uncertainty Penalty (`-0.10`) = **10.57**.
3. Open **Blast Radius** (`/blast-radius`) to show the 2-hop transitive path (`example-lib@1.4.0 -> checkout-sdk@2.1.0 -> service:checkout -> env:prod`).

## Step 3 — Optimize Constrained Plan & Run What-If Simulation (5:00 – 7:30)
1. Open **Remediation Planner** (`/planner`) with `budget_hours=40` and `max_downtime_minutes=30`.
2. Show that OR-Tools CP-SAT selects `example-lib 1.4.0 -> 1.4.3` (`6h` effort, `10m` downtime, `18.4` risk removed) and explicitly explains why `1.4.0 -> 2.0.0` was rejected (`45m > 30m` downtime cap and `0.65` compatibility risk).
3. Open **What If** (`/what-if`) and tighten `max_downtime_minutes` to `5m` to demonstrate infeasibility diagnostics.

## Step 4 — Record Human Approval & Verify Audit Trail (7:30 – 9:00)
1. Switch role to `Analyst` to show that plan approval is blocked (`403 INSUFFICIENT_ROLE`).
2. Switch role to `Approver`, approve `plan_01` with rationale, and inspect the append-only record in **Audit** (`/audit`).
