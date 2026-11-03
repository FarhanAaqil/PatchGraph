# PatchGraph Ranking Evaluation Results (RQ1)

- **Dataset Date**: `2026-11-01` · **Sample Size**: `n=12` findings across 4 ecosystems · **Manifest**: `snap_01` (`9f86d081...`)

## 1. Prioritization Strategy Comparison (Analyst Review Budget k=6)

| Strategy | NDCG@6 | Precision@6 (95% Bootstrap CI) | Recall@6 | PR-AUC | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| `patchgraph_deployment_aware` | 1.0000 | 1.0000 [1.0000, 1.0000] | 1.0000 | 1.0000 | 1.0000 |
| `cvss_descending` | 0.1078 | 0.1667 [0.0000, 0.5000] | 0.1667 | 0.3862 | 0.1667 |
| `epss_descending` | 1.0000 | 1.0000 [1.0000, 1.0000] | 1.0000 | 1.0000 | 1.0000 |
| `kev_first_then_cvss` | 0.6448 | 0.5000 [0.1667, 0.8333] | 0.5000 | 0.7946 | 0.7500 |

## 2. Per-Ecosystem Slice (Top-1 Actionable Precision)
- `pypi`: 1.00 · `npm`: 1.00 · `maven`: 1.00 · `golang`: 1.00
