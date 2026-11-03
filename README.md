# PatchGraph — Explainable, Constrained Supply-Chain Remediation

[![CI](https://github.com/FarhanAaqil/PatchGraph/actions/workflows/ci.yml/badge.svg)](https://github.com/FarhanAaqil/PatchGraph/actions/workflows/ci.yml)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-blue.svg)](contracts/openapi.yaml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](frontend/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](backend/)
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
| - React 18 + Vite     |  (Port 5000) | - SQLite / PostgreSQL 16           |
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
5. **No Invented Data**: Every metric shown comes directly from authenticated API endpoints. Demo data is clearly identified.

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

### Option 1: Standalone Server (Single Command)

```bash
# 1. Activate Python virtual environment and install dependencies
.venv\Scripts\activate
pip install -r requirements.txt

# 2. Build the React + Three.js frontend bundle
cd frontend && npm install && npm run build && cd ..

# 3. Seed demo data
python scripts/seed_demo.py

# 4. Launch unified server (FastAPI + React bundle on Port 5000)
python scripts/run_standalone_server.py --port 5000
```
Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

---

### Option 2: Docker Compose

```bash
# Start backend API, Postgres 16, Redis 7, and Vite frontend
docker compose up
```
- Frontend UI: `http://localhost:5173`
- Backend API & OpenAPI Docs: `http://localhost:5000/docs`

---

## Running Tests

### Backend Unit & Integration Tests (43 tests)

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

### Playwright End-to-End Tests (10 tests)

```bash
# Ensure server is running on port 5000, then run:
npx playwright test
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health and database connectivity |
| `GET` | `/api/v1/sources/status` | Upstream threat feed freshness (OSV, NVD, EPSS, KEV) |
| `POST` | `/api/v1/imports/sbom` | Ingest CycloneDX/SPDX SBOM |
| `POST` | `/api/v1/imports/vex` | Ingest OpenVEX statements |
| `POST` | `/api/v1/imports/topology` | Register application deployment topology |
| `GET` | `/api/v1/graph` | Filtered dependency-and-deployment graph nodes & edges |
| `GET` | `/api/v1/graph/nodes/{id}` | Node blast radius and reachability details |
| `GET` | `/api/v1/findings` | Prioritized risk findings register |
| `GET` | `/api/v1/findings/{id}/explain` | Decomposed risk factor breakdown & Platt formula |
| `POST` | `/api/v1/plans` | Execute OR-Tools CP-SAT remediation optimizer |
| `GET` | `/api/v1/plans` | Query historical planning runs |
| `POST` | `/api/v1/plans/{id}/decision` | Human approval sign-off (writes to immutable audit log) |
| `GET` | `/api/v1/audit` | Append-only governance audit log entries |
| `GET` | `/api/v1/audit/export` | Export audit ledger in JSON or CSV format |

---

## Author

- **Farhan Aaqil** ([@FarhanAaqil](https://github.com/FarhanAaqil))
