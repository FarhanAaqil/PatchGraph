# PatchGraph — Explainable, Constrained Supply-Chain Remediation

[![CI](https://github.com/FarhanAaqil/PatchGraph/actions/workflows/ci.yml/badge.svg)](https://github.com/FarhanAaqil/PatchGraph/actions/workflows/ci.yml)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-blue.svg)](contracts/openapi.yaml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](frontend/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](backend/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](pyproject.toml)
[![OR-Tools](https://img.shields.io/badge/Google%20OR--Tools-CP--SAT-red.svg)](intelligence/planner/)

> **"Patch what matters."**
> PatchGraph explains and recommends; it never patches code automatically. Humans approve. Always. Every remediation decision requires explicit human sign-off with mandatory justification, permanently sealed into an append-only audit log.

---

## Architecture Overview

```
                                      +------------------------------------+
                                      | Upstream Feeds & Ingest Artifacts   |
                                      | - CycloneDX 1.5 & SPDX 2.3 SBOMs   |
                                      | - OpenVEX Machine Justifications   |
                                      | - OSV.dev, NVD CVE 2.0, EPSS, KEV  |
                                      +-----------------+------------------+
                                                        |
                                                        v
+-----------------------+              +----------------+-------------------+
| Modern Web Frontend   | <--- API --- | FastAPI Gateway & Intelligence     |
| - React 18 + Vite     |  (Port 5000) | - SQLite (single file)             |
| - Three.js 3D Graph   |              | - Platt Calibrated Risk Engine     |
| - Cytoscape.js Topo   |              | - Google OR-Tools CP-SAT Solver    |
| - TanStack Query      |              | - Append-Only Audit Ledger         |
| - Command Palette (⌘K)|              +------------------------------------+
+-----------------------+
```

---

## Core Guarantees & Principles

1. **Human Authority**: PatchGraph never pushes code or executes modifications autonomously. Every upgrade action requires explicit operator sign-off with mandatory justification comments permanently recorded in append-only cryptographic audit logs.
2. **Empirical Risk Scoring**: Replaces arbitrary severity scores with Platt-calibrated exploit probabilities, real EPSS percentiles, CISA KEV weaponization evidence, runtime reachability, and asset business criticality.
3. **Constrained Optimization**: Uses Google OR-Tools CP-SAT integer programming to solve optimal upgrade combinations within finite engineering hours, downtime windows, and breaking-change budgets.
4. **Contract-First Architecture**: `contracts/openapi.yaml` is the single source of truth, synchronizing backend routers and generating typed TypeScript clients for the frontend.
5. **No Invented Data**: Metrics come from the stored evidence snapshot and database, and seeded demo records are labelled as such. The offline demo uses placeholder content hashes for its pinned snapshot.

---

## 5-Step Pipeline

```
 [01 Ingest]   ──>   [02 Graph]   ──>   [03 Score]   ──>   [04 Optimize]   ──>   [05 Approve]
  CycloneDX           Reverse BFS        Platt Scaled       Google OR-Tools       Human Sign-Off
  & OpenVEX           Reachability       Exploit Prob       CP-SAT Solver         & Audit Ledger
```

- **01 Ingest (`/ingest`)**: Drag-and-drop CycloneDX 1.5/SPDX SBOMs, OpenVEX statements, and deployment topologies with SHA-256 content hashes.
- **02 Graph (`/graph`)**: Interactive Cytoscape.js 2D/3D view of packages, apps, services, environments, and owners with reverse-traversal hop decay.
- **03 Score (`/risk`)**: Ranked findings register with an "Explain" slide-over drawer exposing exact factor decompositions, Platt scaling math, and model weights.
- **04 Optimize (`/planner`)**: Set effort budgets (0–60h) and maintenance downtime windows (0–90m) to generate mathematically optimal upgrade sets.
- **05 Approve (`/audit`)**: Human review gate with mandatory rationale requirement and an append-only verifiable audit timeline with CSV/JSON export.

---

## Design System

Designed according to a bold, modern, graphical aesthetic:
- **Palette (Exact)**:
  - Silver Metallic: `#E6E9EE`
  - Deep Violet: `#7A0FE0`
  - Electric Indigo: `#4B0F9E`
  - Steel Gray: `#8A929C`
  - Ink Void: `#1A1220`
- **Typography**: Unbounded (Display, heavy tracking), DM Sans (Body text), JetBrains Mono (IDs, CVEs, Hashes).
- **Shape Language**: Big rounded frames (32–44px radius), soft silver drop shadows, huge numerals (`01`–`05`), circular violet arrow buttons, pill navigation.
- **Motion**: Three.js interactive 3D hero scene with layered dependency/deployment hierarchy, pulsing violet vulnerable nodes, travelling light pulses, and camera stage buttons (`01`, `02`, `03`). Full support for `prefers-reduced-motion` and off-screen pause.

---

## Quickstart

### Option 1: Run locally

```bash
# 1. Python environment (3.12)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.lock

# 2. Build the React + Three.js bundle
cd frontend && npm ci && npm run build && cd ..

# 3. Start the API and UI together on port 5000
python scripts/run_standalone_server.py --port 5000
```

Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)**. The first start creates and seeds `data/patchgraph.db`
(override the location with `PATCHGRAPH_SQLITE_PATH`).

### Option 2: Docker

```bash
docker compose up --build
```

One container serves the API and the UI on `http://localhost:5000` (interactive API docs are off by default; set `PATCHGRAPH_ENABLE_DOCS=true` to serve `/docs`), with SQLite on a named
volume. `docker/compose.prod.yml` is the production-style variant: read-only filesystem, bearer tokens required, and
`PATCHGRAPH_AUTH_SIGNING_KEY` must be set.

---

## Authentication

| Mode | When | How callers identify themselves |
|---|---|---|
| Demo (default) | Local runs and tests | `X-Project-Id` / `X-User-Id` headers, defaulting to the seeded approver |
| Production | `PATCHGRAPH_ENV=production` | `Authorization: Bearer <token>` only; identity headers are ignored |

In both modes the caller's role comes from the `memberships` table. `X-User-Role` (or the role inside a token) can
only lower it, never raise it. Tokens are HMAC-signed with `PATCHGRAPH_AUTH_SIGNING_KEY`; production refuses to start
without one. Mint a token with:

```bash
PATCHGRAPH_AUTH_SIGNING_KEY=... python scripts/issue_token.py <user_id> <email> <project_id> <role>
```

The web client sends the token stored in `localStorage` under `patchgraph.token`.

---

## Development

Work happens on `master`; each phase of work is a pull request into `main` that must pass CI before merging
(`scripts/github_pr.py` opens the PR, waits for the checks and merges).

| Check | Command |
|---|---|
| Python lint + format | `ruff check .` and `ruff format --check .` |
| Backend tests (67) | `PYTHONPATH=. python -m unittest discover -s tests -p "test_*.py"` |
| Frontend format, lint, tests (13), build | `cd frontend && npm run format:check && npm run lint && npm test && npm run build` |
| End-to-end (17 Playwright tests) | start the server on port 5000, then `npm ci && npx playwright test` from the repo root |
| Docker image | `docker build .` |

Dependencies: `requirements.txt` lists runtime packages, `requirements-dev.txt` adds tooling, and the `.lock` files pin
exact versions (`uv pip compile requirements.txt --universal --python-version 3.12 -o requirements.lock`).
Tests write experiment output to a scratch directory (`PATCHGRAPH_OUTPUT_DIR`), so running them leaves the tree clean.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health |
| `GET` | `/api/v1/health/data` | Evidence snapshot freshness per source |
| `GET` | `/api/v1/sources/status` | Upstream source status from the stored snapshot (OSV, NVD, EPSS, KEV) |
| `POST` | `/api/v1/demo/load-sample` | Reset to the seeded sample scenario and re-score it |
| `POST` | `/api/v1/imports/sbom` | Ingest CycloneDX/SPDX SBOM (JSON body) |
| `POST` | `/api/v1/sbom/upload` | Ingest an SBOM file upload |
| `POST` | `/api/v1/imports/vex` | Ingest OpenVEX statements |
| `POST` | `/api/v1/imports/topology` | Register application deployment topology |
| `GET` | `/api/v1/imports`, `/api/v1/imports/{id}` | Import history and status |
| `GET` | `/api/v1/jobs/{id}`, `/api/v1/jobs/{id}/events` | Job status (404 for unknown jobs) |
| `GET` | `/api/v1/vex-statements` | Stored VEX statements |
| `GET` | `/api/v1/assets` | Asset inventory |
| `GET` | `/api/v1/graph`, `/api/v1/graph/paths`, `/api/v1/graph/nodes/{id}` | Dependency-and-deployment graph, reverse paths, node blast radius |
| `GET` | `/api/v1/findings`, `/api/v1/findings/{id}` | Prioritized risk findings |
| `GET` | `/api/v1/findings/{id}/explain` | Decomposed risk factor breakdown & Platt formula |
| `POST` | `/api/v1/risk-runs` | Score all findings with the calibrated model |
| `GET` | `/api/v1/risk-runs/latest` | Latest risk run |
| `GET` | `/api/v1/model-card` | Model card and evaluation metrics |
| `POST` | `/api/v1/plans` | Run the OR-Tools CP-SAT remediation optimizer |
| `GET` | `/api/v1/plans`, `/api/v1/plans/{id}` | Planning runs |
| `POST` | `/api/v1/plans/{id}/simulate` | What-if simulation |
| `POST` | `/api/v1/plans/{id}/decision` | Human approval sign-off (writes to the audit log) |
| `GET` | `/api/v1/audit`, `/api/v1/audit/export` | Append-only audit log, JSON or CSV export |

`contracts/openapi.yaml` is the API contract. The running server does not publish `/docs`, `/redoc` or `/openapi.json` unless `PATCHGRAPH_ENABLE_DOCS=true`, and the web interface never shows endpoint URLs or lets users change an API address.

## Known limitations

- Storage is SQLite only. The schema is written as PostgreSQL DDL and translated, but there is no Postgres driver.
- Topology import acknowledges the request but does not yet parse the uploaded topology file.
- `contracts/openapi.yaml` documents a subset of the routes above; the generated docs (when enabled) are complete.
- The frontend still has 27 `any` usages, reported as ESLint warnings.

---

## Author

- **Farhan Aaqil** ([@FarhanAaqil](https://github.com/FarhanAaqil))
