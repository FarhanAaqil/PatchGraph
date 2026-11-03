# PatchGraph Scope, Personas, and Threat Model

## 1. Personas

| Persona | Primary Responsibility | Core Need in PatchGraph |
|---|---|---|
| **Security Analyst** | Triage incoming SBOMs and vulnerability advisories | Evidence-backed prioritization with factor contributions, source freshness, and explicit uncertainty bands |
| **Platform Engineer** | Maintain shared services, clusters, and runtime environments | Deployment-aware blast radius mapping packages to applications, services, assets, environments, and owners |
| **Service Owner** | Upgrade dependencies and maintain service reliability | Compatible upgrade candidates, effort hours, downtime estimates, and rollback guidance |
| **Approver / Security Lead** | Authorize production remediation plans | Constrained trade-off comparison (what-if), explicit human approval workflow, and immutable audit trail |
| **Research Reviewer / Auditor** | Verify claims, reproducibility, and methodology | Frozen content-addressed evidence snapshots, deterministic baselines, leakage-controlled ML splits, and ablation reports |

## 2. Binding Scope Control (Must / Should / Could / Will Not)

### Must Have (MVP Defensibility Floor — Phases 1–4)
- **SBOM Ingestion**: CycloneDX JSON (1.4–1.6) and SPDX JSON (2.3) validation and idempotent normalization with location-specific error reporting.
- **Normalized Vulnerability Evidence**: Content-addressed snapshots from OSV, NVD CVE API 2.0, FIRST EPSS, and CISA KEV with `source_url`, `fetched_at`, and `content_sha256`.
- **Deployment-Aware Graph**: Typed dependency-and-deployment graph (`package -> version -> application -> service -> asset -> environment -> owner`) using PostgreSQL 16 + NetworkX bounded traversal (max depth 12, cycle-safe).
- **Explainable Risk Baseline**: Deterministic weighted risk formula combining severity, exploit likelihood, criticality, reachability, KEV status, and uncertainty penalty.
- **One Calibrated ML Model**: Time-aware, calibrated logistic regression for exploit likelihood (`p(exploit)`) with disclosure-time and package-family split controls.
- **Constrained Remediation Optimizer**: OR-Tools CP-SAT solver selecting upgrades/mitigations under engineering hour budgets, per-service downtime caps, version uniqueness, precedence, and compatibility constraints.
- **What-If Comparison**: Side-by-side simulation under modified constraints against greedy baselines (risk-descending and risk-per-hour).
- **Human Approval & Audit Log**: Explicit `approved` / `rejected` / `needs_changes` decision workflow with append-only `audit_logs`.
- **Offline Reproducible Demo**: Full seeded vertical slice reproducible from pinned snapshots without outbound network access.

### Should Have (Phases 5–7)
- **VEX Context**: OpenVEX and CycloneDX VEX ingestion qualifying finding status (`affected`, `not_affected`, `fixed`, `under_investigation`) with justification without deleting matches.
- **Remediation Effort Model (Model Two)**: Regularized regression / quantile model estimating effort hours from version jump, centrality, and affected service count.
- **Owner Routing**: Service and team ownership queues.
- **Model Calibration Views**: Reliability curves and Brier/ECE metrics.
- **Restore Automation & Accessibility Audit**: Tested database backup/restore drill and keyboard-only WCAG compliance pass.
- **Stress Benchmark**: Validation toward 100k dependency edges, 20k assets, and 50k findings.

### Could Have (Stretch Only After Gate 7)
- Additional package ecosystems beyond core fixtures.
- Richer static/call-graph reachability evidence import.
- Hosted OIDC provider integration beyond local OIDC-compatible boundary.
- Incremental graph delta refresh.

### Will Not Have (Strictly Prohibited)
- **No Active Exploit Testing or Active Scanning**: PatchGraph never probes, attacks, or scans live targets.
- **No Autonomous Patching or Agentic Code Modification**: PatchGraph never opens automated pull requests, modifies user repositories, or deploys changes. Every remediation plan terminates in a human decision record.
- **No Paid or Proprietary Threat Feeds**: All evidence sources must remain public and redistributable in pinned test fixtures.
- **No Unapproved Infrastructure Substitutions**: No Neo4j, no Kubernetes, no Elasticsearch, and no Graph Neural Networks replacing deterministic traversal.

## 3. Abuse Cases and Threat Model

| Threat / Abuse Case | Attack Vector | Impact | Enforced Controls |
|---|---|---|---|
| **Malicious SBOM / VEX Upload** | Oversized payload, deeply nested JSON bomb, cyclic dependency explosion, or XSS payload in package/advisory strings | Parser memory exhaustion, denial of service, or stored UI injection | 25 MB upload size cap, JSON depth limit (<= 64) and node count cap (<= 100,000), strict schema validation, non-executing parser, escaped React rendering, cycle-safe bounded traversal (depth <= 12) |
| **Sensitive Topology Exposure** | Cross-tenant query or unmasked export leaking internal service-to-asset production mappings | Attacker reconnaissance of critical internal services | Project-scoped authorization (`memberships` role check on every query), role enforcement (`viewer`, `analyst`, `approver`, `admin`), masked exports, append-only audit logging |
| **Poisoned External Evidence** | Compromised upstream response, MITM, or unverified probability out of `[0,1]` skewing prioritization | Critical vulnerabilities suppressed or false upgrades prioritized | Allowlisted HTTPS sources only, schema validation, `[0,1]` probability bounds, `content_sha256` pinning in `evidence_snapshots`, anomaly checks, visible source freshness |
| **Silent Stale Fallback** | Outbound API 429/5xx causes stale cache to be presented as fresh live intelligence | Analyst approves plan under outdated KEV/EPSS assumptions | Explicit `stale` indicator and `source_cutoffs` timestamp on `/api/v1/health/data` and all finding/plan views |
| **Unauthorized Plan Approval** | Viewer or analyst role attempts to approve a production remediation plan | Bypass of human governance gate | `POST /api/v1/plans/{id}/decision` restricted to `approver` and `admin` roles; records actor, reason, request ID, and before/after state in `audit_logs` |
| **Secret Leakage in Snapshots/Logs** | API tokens or environment variables written into raw evidence snapshots or error payloads | Credential compromise | Secret redaction filter on logs and snapshots; no environment dumps; credentials isolated to runtime config |
