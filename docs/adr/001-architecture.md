# ADR 001: Modular Monolith Architecture, Trust Boundaries, and Deterministic Graph/Solver Core

- **Status**: Accepted (Phase 1 — Architecture Skeleton)
- **Date**: 2026-11-02
- **Owners**: Member 1 (Backend, Data, Graph) & Member 2 (Frontend, ML, Optimizer, Evaluation)

## 1. Context

PatchGraph must ingest untrusted SBOM/VEX documents and public vulnerability feeds (OSV, NVD, EPSS, CISA KEV), resolve service blast radius across a typed dependency-and-deployment graph, rank findings with explainable baseline and calibrated ML scores, compute constrained remediation plans via OR-Tools CP-SAT, and enforce human approval with an immutable audit trail. The system must be maintainable by a two-person team across 56 days and run reproducibly offline on a standard developer laptop without a GPU or paid feeds.

## 2. Decisions

### 2.1 Modular Monolith with Strict Package Ownership
We adopt a single repository containing strictly separated top-level modules:
- `backend/app/{ingest,connectors,catalog,graph,api,db,jobs,security}` (Owned by Member 1)
- `intelligence/{risk,planner}` and `experiments/` (Owned by Member 2)
- `frontend/src/{api,app,components,content,pages}` (Owned by Member 2)
- `contracts/`, `data/fixtures/`, `tests/`, `docs/` (Shared via contract PRs)

**Enforcement Invariant**: `backend/` never imports `frontend/` or `experiments/`. `intelligence/` consumes versioned domain dataclasses/dicts and returns typed results with factor explanations. All frontend-to-backend communication crosses the `/api/v1` HTTP contract with a `request_id` on every response.

### 2.2 PostgreSQL 16 + In-Process NetworkX Graph Projection
PostgreSQL 16 (`30_PatchGraph_Schema.sql`) is the single authoritative store for relational entities, graph edges (`dependencies`, `service_components`, `deployments`), evidence snapshots (`evidence_snapshots`), immutable run records (`risk_runs`, `planning_runs`), and `audit_logs`.
- Graph traversal uses an in-process NetworkX directed multigraph projected from PostgreSQL tables for a given project and import/snapshot, bounded at depth 12 with cycle detection.
- **Rejected**: Neo4j (synchronization overhead between relational evidence and graph state), Kubernetes (operational complexity), and GNNs (lack edge-level ground-truth labels).

### 2.3 Strict Separation of Deterministic Rules and Machine Learning
- **Deterministic Only**: SBOM/VEX parsing, version-range matching, graph reachability/blast-radius traversal, VEX status resolution, RBAC authorization, and CP-SAT constraint satisfaction.
- **Calibrated Tabular ML Only**: Model One (exploit likelihood via calibrated logistic regression / gradient boosting) and Model Two (remediation effort estimation), trained with time-based disclosure splits and package-family grouping to prevent temporal leakage. If a model bundle is unavailable or fails, the risk engine deterministically falls back to the explicit weighted baseline formula.

### 2.4 Trust Zones and Untrusted Input Handling
1. **Zone 0 — Untrusted External Inputs**: Uploaded CycloneDX/SPDX/VEX files and external API payloads (OSV, NVD, EPSS, KEV). Enforced controls: 25 MB cap, JSON nesting depth <= 64, node limit <= 100,000, allowlisted media types, schema validation, no dynamic code execution, content SHA-256 hashing.
2. **Zone 1 — Validated Evidence Store**: Content-addressed raw snapshots and normalized PostgreSQL tables (`advisories`, `exploit_evidence`, `evidence_snapshots`).
3. **Zone 2 — Project-Scoped Analysis & Planning Engine**: Graph projection, risk scoring, and CP-SAT optimization scoped strictly by `project_id` and verified against `memberships`.
4. **Zone 3 — Human Governance & Append-Only Audit**: `POST /api/v1/plans/{id}/decision` requires `approver` or `admin` membership role and writes immutable records to `plan_decisions` and `audit_logs`.

## 3. Consequences
- Every score and remediation plan can be reproduced bit-for-bit from a single `evidence_snapshot` (`manifest_sha256`), `model_version`, and solver seed.
- Two engineers can work in parallel daily without merge collisions by respecting the `contracts/openapi.yaml` and `intelligence/` boundaries.
