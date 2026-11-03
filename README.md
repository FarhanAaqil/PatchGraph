# PatchGraph — Software Supply-Chain Intelligence System

A software supply-chain intelligence system for explainable, constrained remediation planning. PatchGraph turns CycloneDX and SPDX SBOMs, OpenVEX statements, public vulnerability intelligence (OSV, NVD CVE 2.0, FIRST EPSS, CISA KEV), and deployment topology into a prioritized, human-approved remediation plan optimized with Google OR-Tools CP-SAT.

## Overview

Security teams often triage CVEs by flat severity scores, overlooking deployment topology, service reachability, and conflicting patch constraints. PatchGraph bridges this gap by combining:
1. **Typed Dependency-and-Deployment Graph**: Maps packages, applications, services, environments, and owners with bounded reverse BFS traversal and hop decay.
2. **Calibrated Risk Model**: Combines deterministic severity metrics, Platt-calibrated exploitation probability, asset criticality, reachability states, and KEV catalog presence.
3. **Constrained Remediation Optimizer**: Jointly selects minimal, high-impact upgrade packages under real engineering effort, downtime budgets, and compatibility constraints.
4. **Human Authority**: PatchGraph explains and recommends; it never auto-patches or modifies code autonomously. All decisions require explicit human sign-off recorded in append-only audit logs.

## Repository Structure

- `backend/`: FastAPI application, database migrations, graph builders, threat connectors, and background jobs.
- `intelligence/`: Exploit likelihood models, risk baseline calculators, and OR-Tools CP-SAT remediation planner.
- `frontend/`: Interactive React/Vite workbench with Cytoscape.js dependency graph visualization.
- `contracts/`: OpenAPI 3.1 specifications.
- `data/`: Curated datasets, model bundles, and seed fixtures.
- `experiments/`: Research evaluation harness, single-factor ablations, and stress test suites.
- `docs/`: Architecture decision records, domain models, and demo operator guides.
- `scripts/`: Offline demo reset tools and test runners.

## Author

- **Farhan Aaqil** (@FarhanAaqil) — AI Engineer Intern & Final-Year B.Tech AI/ML
