# Changelog — PatchGraph

## [1.1.0] — 2026-11-11
### Interface
- The web interface no longer shows endpoint URLs or backend wording, and the Settings screen no longer has an "API Gateway Endpoint" field. `/docs`, `/redoc` and `/openapi.json` are not served unless `PATCHGRAPH_ENABLE_DOCS=true`.
- The audit export button called a doubled path (`/api/v1/api/v1/audit/export`) whenever the default base URL was set; it now calls the right one.

### Security
- A caller's role now always comes from the `memberships` table. `X-User-Role` can lower it but no longer raise it, and requests without headers no longer run as the seeded approver in production.
- Signed bearer tokens are supported end to end (`scripts/issue_token.py`, client `token` option). The signing key comes from `PATCHGRAPH_AUTH_SIGNING_KEY`; production refuses to start without it and no key is committed.
- CORS reads `CORS_ORIGINS` and never answers with a wildcard alongside credentials.
- The audit listing builds its SQL from fixed fragments and reports the real actor email.
- Removed the unused `httpx2` requirement.

### Fixed
- Intermittent `403 FORBIDDEN_PROJECT_SCOPE` responses: the auth dependency ran in a worker thread against the shared SQLite connection while handlers committed on the event loop. It now runs on the loop, and reloading sample data no longer deletes users, projects or memberships.
- `/jobs/{id}` answered "completed" for any id; jobs now record whether they finished or failed, are project-scoped, and unknown ids return 404.
- `/sources/status` returned invented record counts and a made-up snapshot hash; it now reflects the stored evidence snapshot.
- Missing `Tuple` import in the planner explainer, plus unused variables and exception chains flagged by ruff.
- File uploads from the web client now send the same identity headers as every other request.

### Changed
- Source is LF everywhere (`.gitattributes`) and formatted with ruff (Python) and Prettier (frontend). `routes.py` went from 7,273 lines to nine per-area modules, and `generated.ts` from 2,430 lines to about 630.
- The planner and risk re-export wrappers under `backend/app` were folded into `intelligence/`.
- Experiment outputs are written through `experiments/paths.py`; tests use a scratch directory and no longer modify tracked files.
- Python dependencies are split into runtime and dev sets with uv lock files; unused packages (pandas, scipy, networkx, python-dateutil) were dropped.
- One multi-stage `Dockerfile`, a one-service compose file, a production compose file and a single-replica k8s manifest replace the Postgres/Redis stack the app never used.
- CI runs ruff, Prettier, ESLint, vitest, the backend suite, the frontend build and a Docker build with a health probe on every PR into `main`.

### Added
- Frontend unit tests (API client, routes, session expiry, severity vocabulary), a security test module for the auth boundary, and regression tests for the fixes above.
- Dependabot configuration for pip and npm and GitHub Actions (grouped, minor/patch only).

### Removed
- Duplicate `backend/openapi.yaml`, `docker/compose.yml`, the Alembic-style migration wrapper, the legacy static pages and their generator, and the stale gate-manifest scripts.

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
