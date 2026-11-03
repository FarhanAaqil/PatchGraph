# Changelog — PatchGraph

## [1.0.0] — 2026-11-02
### Added
- **Phase 1 (Architecture Skeleton)**: Modular monolith layout, PostgreSQL 16 schema (`001_core.sql` with 26 tables and 10 indexes), OpenAPI 3.1 contract (`/api/v1` with 12 endpoints), typed TypeScript client, and 14-screen React shell.
- **Phase 2 (Data Flow)**: CycloneDX (1.4–1.6) and SPDX (2.3) validation with location-specific field errors, PURL canonicalization, content-addressed OSV/NVD/EPSS/KEV connectors, and staleness detection.
- **Phase 3 (Intelligence Slice)**: Cycle-safe bounded graph traversal (depth <= 12), blast-radius aggregation, explainable deterministic risk baseline, and Platt-calibrated logistic regression with disclosure-time and package-family leakage controls.
- **Phase 4 (End-to-End MVP)**: OR-Tools CP-SAT constrained remediation optimizer, side-by-side What-If simulation, greedy baseline comparators, and human approval workflow with append-only audit logging.
- **Phase 5 (Decision Intelligence)**: Non-destructive OpenVEX qualification, owner routing queues, graph centrality features, drift monitoring, and idempotent refresh jobs.
- **Phase 6 (System Ready)**: Local OIDC-compatible authentication, project RBAC, upload parser limits (25 MB, depth <= 64, node cap <= 100k), secret redaction, and verified database backup/restore drill.
- **Phase 7 (Evidence Ready)**: Reproducible evaluation harness, 95% bootstrap confidence intervals, 7 single-factor ablations, and scale stress tests.
- **Phase 8 (Demo Ready)**: Offline resettable demo tool (`scripts/reset_demo.py`), operator runbook, presentation figures, and signed-off release manifest.
