# PatchGraph Controlled Ablation Study Results (Day 47)

Each ablation removes exactly one component while keeping snapshot `snap_01` (`9f86d081...`) frozen.

| Ablation Variant | Ranking NDCG@6 | Planner Exposure Removed (10h Budget) | Calibration Brier Score |
|---|---:|---:|---:|
| `Full PatchGraph System` | 1.0000 | 16.70 | 0.0085 |
| `1. Remove Deployment Context (gamma=0)` | 1.0000 | 16.70 | 0.0085 |
| `2. Remove Reachability (delta=0)` | 1.0000 | 16.70 | 0.0085 |
| `3. Remove Graph Centrality` | 1.0000 | 16.70 | 0.0085 |
| `4. Remove EPSS Signal (beta=0)` | 1.0000 | 16.70 | 0.0085 |
| `5. Remove Probability Calibration` | 1.0000 | 16.70 | 0.0214 |
| `6. Replace CP-SAT Optimizer with Greedy` | 1.0000 | 12.00 | 0.0085 |
| `7. Remove VEX Qualification` | 1.0000 | 16.70 | 0.0085 |
