# PatchGraph Redesign & End-to-End Integration Notes

> **Document Status**: Step 1 Architectural Inspection & Gap Analysis  
> **Author**: Farhan Aaqil (`fadurrani543@gmail.com`)  
> **Date**: 2026-11-03  
> **Repository**: `FarhanAaqil/PatchGraph`  

---

## 1. System Overview & Core Promises

PatchGraph is an explainable software supply-chain intelligence and constrained remediation planning platform.
Its core architectural invariants:
1. **Explain & Recommend, Never Auto-Patch**: PatchGraph never modifies code or deploys fixes autonomously.
2. **Human Authority**: All remediation actions require explicit human sign-off with mandatory justification comments.
3. **Immutable Governance**: Human decisions and pipeline runs are recorded in an append-only audit log (`audit_logs` and `plan_decisions` tables). There are no delete or update routes for audit entries.
4. **Deterministic & Calibrated Math**: Combines deterministic CVSS severity, Platt-calibrated exploitation likelihood, reachability-decayed blast radius, and Google OR-Tools CP-SAT knapsack optimization.
5. **Contract-First Source of Truth**: `contracts/openapi.yaml` defines the API surface. Typed TypeScript models in the frontend derive strictly from this schema with zero mock data in production code paths.

---

## 2. Existing Endpoints Audit

Currently mounted in `backend/app/api/routes.py` (versioned under `/api/v1`):

| Endpoint | Method | Status & Behavior | Request Payload / Params | Response Summary |
| :--- | :--- | :--- | :--- | :--- |
| `/imports/sbom` | `POST` | Ingests CycloneDX 1.5 & SPDX 2.3 JSON documents. Computes content SHA-256 and detects duplicate edge collapsing. | `{kind: "cyclonedx"\|"spdx", source_name, document}` | `{id, status, content_sha256, ...}` |
| `/imports/vex` | `POST` | Ingests OpenVEX advisories with statement qualifications (`affected`, `not_affected`, etc.). | `{source_name, document}` | `{id, kind: "vex", status, ...}` |
| `/imports/{id}` | `GET` | Fetches import status, parser version, validation errors, and SHA-256. | Path parameter `id` | `{id, status, errors, content_sha256, ...}` |
| `/assets` | `GET` | Returns filtered deployment topology (container deployments, hosts, serverless). | Query `environment`, `production` | `{items: [...], total, request_id}` |
| `/findings` | `GET` | Returns prioritized vulnerability findings with calibrated scores. | Query `environment`, `service_name`, `status` | `{items: [...], total, evidence_snapshot}` |
| `/findings/{id}` | `GET` | Full finding detail with CVE advisories, reachability paths, and candidate actions. | Path parameter `id` | `{id, advisories, affected_paths, candidate_actions, ...}` |
| `/graph/paths` | `GET` | Bounded graph traversal (depth 1..12) with hop decay factor and blast radius. | Query `package_version_id`, `depth`, `limit` | `{root_id, depth, paths, affected_services, nodes, edges}` |
| `/risk-runs` | `POST` | Executes risk prioritization scoring against the latest evidence snapshot. | `{model_version}` | `{id, snapshot_id, manifest_sha256, scored_findings, ...}` |
| `/plans` | `POST` | Runs OR-Tools CP-SAT multi-objective remediation planner under constraints. | `{budget_hours, max_downtime_minutes, environments}` | `{id, status: "optimal"\|"infeasible", actions, rejected_actions, ...}` |
| `/plans/{id}/simulate` | `POST` | Side-by-side sensitivity simulation comparing CP-SAT against greedy knapsack. | `{budget_hours, max_downtime_minutes}` | `{baseline_plan, simulated_plan, greedy_comparison, deltas}` |
| `/plans/{id}/decision` | `POST` | Human sign-off recording `approved`, `rejected`, or `needs_changes` into audit log. | `{decision, reason}` (min 3 chars required) | `{id, planning_run_id, decision, reason, audit_log_id}` |
| `/health/data` | `GET` | Data health indicators, external feed freshness, snapshot manifest SHA-256. | None | `{overall_status, sources, manifest_sha256, ...}` |

---

## 3. Database Models & Schema Audit

Defined in `backend/migrations/001_core.sql` and managed by `backend/app/db/session.py` (26 canonical relational tables):

1. **Identity & Scope**: `projects`, `users`, `memberships` (viewer, analyst, approver, admin).
2. **Topology & Catalog**: `applications`, `services`, `environments`, `assets`, `service_components`, `deployments`.
3. **Software Composition**: `packages`, `package_versions`, `dependencies`, `imports`.
4. **Threat Intelligence & VEX**: `vulnerabilities`, `advisories`, `affected_ranges`, `exploit_evidence`, `vex_statements`.
5. **Evidence & Prioritization**: `evidence_snapshots`, `findings`, `risk_runs`, `finding_scores`.
6. **Remediation & Governance**:
   - `planning_runs`: Solver status, runtime, binding constraints, objective value.
   - `remediation_actions`: Upgrade jumps (`package`, `from_version`, `to_version`, `hours`, `downtime`).
   - `plan_decisions`: Human approval status (`approved`, `rejected`, `needs_changes`) with operator ID and timestamp.
   - `audit_logs`: Immutable, append-only log of every state transition (`action`, `entity_type`, `entity_id`, `before_state`, `after_state`).

---

## 4. Intelligence Engines Audit

### 4.1. CP-SAT Remediation Planner (`intelligence/planner/`)
- **Engine**: Google OR-Tools CP-SAT (`cp_model.CpModel`, `cp_model.CpSolver`).
- **Decision Variables**: Boolean $x_{p,v} \in \{0, 1\}$ for candidate upgrade $v$ of package $p$.
- **Hard Constraints**:
  - $\sum_{p,v} \text{effort}(p,v) \cdot x_{p,v} \le \text{budget\_hours}$
  - $\max_{p,v} (\text{downtime}(p,v) \cdot x_{p,v}) \le \text{max\_downtime\_minutes}$
  - $\sum_v x_{p,v} \le 1$ (version uniqueness: a package can only be upgraded to one target version).
  - Compatibility gate: blocks breaking API modifications on high-criticality services.
- **Objective**: Maximize total risk reduction $\sum \Delta\text{Risk}(p,v) \cdot x_{p,v} - \lambda \sum \text{effort}(p,v) \cdot x_{p,v}$.
- **Diagnostic Infeasibility**: `intelligence/planner/explain.py` extracts minimum relaxation bounds when constraints are too tight.

### 4.2. Calibrated Exploitability & Risk Engine (`intelligence/risk/`)
- **Features**: CVSS base score, exploit code maturity, EPSS percentile, CISA KEV catalog presence, asset criticality, network reachability state (`reachable_prod`, `transitive_internal`, `unreachable_vex`).
- **Platt Calibration**: Logistic regression mapping raw feature vector to posterior exploitation likelihood $P(\text{exploit} \mid \text{features}) \in [0, 1]$ with zero temporal or family leakage.
- **Multi-Factor Baseline**: $\text{Score} = \alpha \cdot \text{Severity} + \beta \cdot P(\text{exploit}) + \gamma \cdot \text{Criticality} + \delta \cdot \text{Reachability} + \epsilon \cdot \text{KEV} - \lambda \cdot \text{Uncertainty}$.

---

## 5. Current Frontend Audit & What It Calls

- **Structure**:
  - React 18 + Vite + TypeScript in `frontend/src/`.
  - Routes defined in `frontend/src/app/routes.tsx` (14 screens).
  - API Client in `frontend/src/api/generated.ts` targeting `/api/v1/*`.
  - Cytoscape.js component in `frontend/src/pages/DependencyGraph.tsx`.
- **Standalone Console**:
  - `frontend/standalone_preview.html` and `frontend/pages/*.html` serve the direct web application on `http://127.0.0.1:5000/`.

---

## 6. Identified Gaps & Target Requirements

To satisfy the user prompt's design direction, frontend architecture, and backend extensions:

### 6.1. Backend API Additions & Enhancements
1. **Audit Log Inspection & Export**:
   - `GET /api/v1/audit` (or `GET /audit`): Query `audit_logs` table with action, actor, and date filters with pagination.
   - `GET /api/v1/audit/export`: Stream full audit log as JSON or CSV.
2. **Finding Score Explainability**:
   - `GET /api/v1/findings/{id}/explain`: Score breakdown containing raw feature weights, Platt probability curve, KEV bonus, reachability decay, and uncertainty bounds.
3. **Graph Topology Endpoints**:
   - `GET /api/v1/graph` (or `GET /graph`): Full graph with filtering by `environment`, `owner`, `severity`, `in_kev`, supporting Cytoscape JSON format.
   - `GET /api/v1/graph/nodes/{id}`: Deep node detail with upstream callers, downstream blast radius, and VEX justification.
4. **Remediation Plans Management**:
   - `GET /api/v1/plans`: List stored planning runs with objective values and approval states.
   - `GET /api/v1/plans/{id}`: Retrieve a specific plan with all proposed actions and solver diagnostics.
5. **Real-time Ingestion & Jobs**:
   - `POST /api/v1/imports/topology` (or `POST /ingest/topology`): Multipart/JSON ingestion of deployment topology.
   - `GET /api/v1/jobs/{id}` and `GET /api/v1/jobs/{id}/events` (SSE): Streaming job progress for long-running ingestions.
6. **Data Sources & Health Status**:
   - `GET /health`: Direct top-level system health check.
   - `GET /sources/status`: Connector freshness table (OSV, NVD, EPSS, CISA KEV) with last sync timestamps and content hashes.
7. **Idempotent Seed Script**:
   - `scripts/seed_demo.py`: Seeds a realistic demo environment with SBOM, topology, findings, and pre-computed risk scores, clearly tagged as `"Demo data"`.

### 6.2. Frontend Design & UX Requirements
1. **Design System & Palette (Exact)**:
   - Silver `#E6E9EE` (metallic gradients for light surfaces)
   - Violet `#7A0FE0` (primary actions, patch path, active glows)
   - Indigo `#4B0F9E` (secondary accents, deep card backdrops)
   - Steel Gray `#8A929C` (labels, subtle borders, captions)
   - Ink `#1A1220` (workbench panels, dark mode contrast base)
2. **Typography**:
   - **Unbounded**: Bold display headers, large section titles, huge numerals `01`–`05`.
   - **DM Sans**: Clean, high-legibility body copy and descriptions.
   - **JetBrains Mono**: Package names, PURLs, CVE IDs, hashes, solver metrics.
3. **Shape Language & Components**:
   - Rounded frames (32–44px radius)
   - White-framed hero card with soft silver shadow
   - Huge numerals (`01` Ingest, `02` Graph, `03` Score, `04` Optimize, `05` Approve)
   - Circular violet arrow buttons with white rings
   - Pill navigation and status chips
4. **Motion & 3D Three.js Hero**:
   - Three.js WebGL hero scene: 3D layered graph (packages → apps → services → environments), glowing violet vulnerable nodes, travelling light pulses along the patch path, slow rings and dust particles, interactive mouse parallax, and stage buttons `01` / `02` / `03` animating camera transitions.
   - Respects `prefers-reduced-motion` and pauses when off-screen.
5. **Cytoscape.js Graph Workbench**:
   - Dedicated interactive canvas styled with the palette, node tap inspector drawer, hop decay traversal highlighting, and 2D/3D toggle.
6. **No Mock Data Promise**:
   - Every metric, table row, and graph node binds directly to FastAPI endpoints. Missing values render honest empty states; seeded demo data is explicitly tagged `"Demo data"`.

---

## 7. Execution Plan

1. **Phase 1: Contract & Backend Extensions**
   - Update `contracts/openapi.yaml` and `backend/openapi.yaml` to declare all new endpoints (`/audit`, `/audit/export`, `/findings/{id}/explain`, `/graph`, `/graph/nodes/{id}`, `/plans` GET, `/health`, `/sources/status`, `/imports/topology`, `/jobs/{id}`).
   - Update `tests/unit/test_phase1_contracts_and_schema.py` to match the enhanced contract.
   - Implement the corresponding router endpoints in `backend/app/api/routes.py`.
   - Add `scripts/seed_demo.py` for reproducible demo environment initialization.
   - Verify all backend unit and integration tests pass.
2. **Phase 2: Frontend Client & Design Tokens**
   - Update `frontend/src/api/generated.ts` to export typed interfaces and client methods for all endpoints.
   - Create `frontend/src/styles/tokens.css` with exact palette variables, radii, typography, and motion tokens.
   - Create `docs/DESIGN_SYSTEM.md` documenting tokens, typography, and accessibility criteria.
3. **Phase 3: Component Library & Three.js 3D Engine**
   - Build reusable components: PillNav, CircularArrowButton, HugeNumeralCard, GlassPanel, ExplainDrawer, CommandPalette (`⌘K`).
   - Implement Three.js hero scene with 3D layered topology, glowing violet patch path, particle dust, and camera stage controls.
4. **Phase 4: Full Pages Implementation**
   - Landing (`/`), Ingest (`/ingest`), Graph (`/graph`), Risk (`/risk`), Planner (`/planner`), Review & Audit (`/review`, `/audit`), Settings (`/settings`).
   - Wire each page end-to-end to real backend APIs with TanStack Query.
5. **Phase 5: Tests, Docker & Documentation**
   - Implement backend unit tests for new routes in `tests/unit/test_new_api_endpoints.py`.
   - Add/update Playwright e2e test covering full pipeline flow.
   - Update `docker/compose.prod.yml` and `.env.example`.
   - Update `README.md` with new screenshots, quickstart, and human-approval guarantee.
6. **Phase 6: Commit, Pull Request & Verification**
   - Git commit on `master` with humanized message (Author: Farhan Aaqil).
   - PR opened and auto-merged into `main` via `scripts/github_pr.py`.
