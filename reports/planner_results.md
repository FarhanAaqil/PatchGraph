# PatchGraph Remediation Planner Evaluation Results (RQ2)

- **Dataset Date**: `2026-11-01` · **Engineering Budget**: `10.0 hours` · **Max Downtime**: `30 minutes` · **Manifest**: `snap_01`

| Planner Method | Weighted Exposure Removed | Effort Used (h) | Downtime Used (m) | Compatibility Penalty | Optimality Gap |
|---|---:|---:|---:|---:|---:|
| `OR-Tools CP-SAT (Constrained)` | **16.70** | 10.0h | 20m | 0.10 | 0.0000 |
| `Greedy Risk-Descending` | 12.00 | 10.0h | 10m | 0.08 | N/A |
| `Greedy Risk-per-Hour` | 16.70 | 10.0h | 20m | 0.10 | N/A |
| `Unconstrained Compatibility Baseline` | 16.70 | 10.0h | 20m | 0.10 (Violates 0.50 ceiling) | 0.0000 |
