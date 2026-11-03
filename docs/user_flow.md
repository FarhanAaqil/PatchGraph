# PatchGraph Analyst Workflow and Screen Inventory

## 1. Primary End-to-End Analyst Flow

```text
[1. Upload & Validate SBOM/VEX]
        |
        v
[2. Map Applications, Services, Assets & Environments]
        |
        v
[3. Refresh / Freeze Public Evidence Snapshot (OSV, NVD, EPSS, KEV)]
        |
        v
[4. Filter Ranked Findings (Prioritization Queue)]
        |
        v
[5. Inspect Finding Detail, Vulnerable Graph Paths & VEX Status]
        |
        v
[6. Generate & Constrain Remediation Plan (CP-SAT Optimizer)]
        |
        v
[7. Compare Trade-Offs in What-If Simulation (Greedy vs Optimized)]
        |
        v
[8. Record Human Decision (Approve / Reject / Needs Changes) & Export Audit Queue]
```

## 2. Screen Inventory (14 Canonical Views)

| # | Screen | Route | Primary Purpose | Key Evidence Displayed |
|---|---|---|---|---|
| 1 | **Dashboard** | `/` | Executive & operational overview of urgent exposed services and data health | Urgent production services, open KEV count, stale source banners, recent runs |
| 2 | **Assets** | `/assets` | Filtered inventory of applications, services, assets, and environments | Criticality (1–5), production flag, max downtime minutes, owner email |
| 3 | **Dependency Graph** | `/graph` | Interactive Cytoscape.js dependency-and-deployment topology + accessible table view | Typed nodes/edges, search, depth filter (1–12), path highlighting, text table alternative |
| 4 | **Vulnerabilities** | `/vulnerabilities` | Catalog of normalized CVEs/advisories matched in project | Canonical ID, OSV/NVD provenance, CVSS vector, EPSS score/percentile, KEV status |
| 5 | **Prioritization** | `/prioritization` | Ranked findings queue with baseline vs calibrated model scores | Final score, baseline score, `p(exploit)`, uncertainty band, VEX status, affected services |
| 6 | **Finding Detail** | `/findings/:id` | Deep inspection of a single finding's evidence and paths | Source records, version range match logic, reachability state, owners, factor breakdown |
| 7 | **Explainability** | `/explainability` | Model metadata, factor contributions, and calibration diagnostics | Formula weights, logistic regression coefficients, reliability plot, leakage controls |
| 8 | **Blast Radius** | `/blast-radius` | Bounded traversal impact summary from package version to services | Hop depth, reachability decay, affected production vs non-prod services, owners |
| 9 | **Remediation Planner** | `/planner` | Constrained optimization workspace (OR-Tools CP-SAT) | Budget hours, max downtime, environment filter, selected actions, rejected high-risk actions, binding constraints |
| 10 | **What-If Simulation** | `/what-if` | Side-by-side comparison of candidate plans under altered constraints | Plan A vs Plan B vs Greedy baseline: risk removed, effort hours, downtime, compatibility risk |
| 11 | **SBOM & VEX Imports** | `/imports` | Upload and inspect CycloneDX, SPDX, and VEX documents | Content SHA-256, parser version, field-level validation errors by location, fixture loader |
| 12 | **Runs** | `/runs` | Immutable registry of evidence snapshots, risk runs, and planning runs | `manifest_sha256`, `model_version`, `risk_run_id`, `planning_run_id`, reproducibility verification |
| 13 | **Audit Log** | `/audit` | Append-only governance record of imports, runs, and human plan decisions | Actor, role, action, entity type/ID, request ID, timestamp, before/after state diff |
| 14 | **Data Health** | `/health` | Source freshness, connector error rates, and degraded-mode status | OSV/NVD/EPSS/KEV last fetch time, snapshot hash, staleness warning, offline demo indicator |

## 3. Mandatory UI States Across Every Screen

Every screen in PatchGraph explicitly handles and tests seven deterministic operational states:

1. **`loading`**: Skeleton placeholders with accessible `aria-busy="true"` status announcement.
2. **`empty`**: Clear guidance when no SBOM or run exists yet, with a one-click action to load the seeded fixture scenario.
3. **`stale`**: Visible amber banner whenever any external evidence source exceeds its freshness threshold or falls back to a cached snapshot, displaying the exact `source_cutoffs` timestamp.
4. **`partial`**: Explicit uncertainty badge when a finding lacks NVD CVSS or EPSS data — **unknown values are never rendered as safe or zero**.
5. **`unauthorized`**: Role-aware banner and disabled mutation controls when the active role (`viewer` or `analyst`) lacks permission for an action (e.g., plan approval requires `approver` or `admin`).
6. **`failed`**: Structured error alert displaying `{code, message, field_errors, request_id}` so the analyst can copy the request ID or fix malformed input fields.
7. **`offline-demo`**: Pin badge indicating the system is operating deterministically against frozen local snapshots (`snap_seed_01`) with zero external network dependency.

## 4. Accessibility & Interaction Invariants
- Every severity, reachability, and VEX badge includes an explicit text label alongside color coding.
- Every graph visualization provides a synchronized tabular path view for keyboard-only and screen-reader users.
- Destructive or governance actions (plan approval/rejection) require an explicit confirmation step and a non-empty rationale string.
- Filter states synchronize with URL query parameters for reproducible sharing.
