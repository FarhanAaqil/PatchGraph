# PatchGraph Claim-to-Evidence Verification Map (Gate 7)

Every research claim in the final presentation and blueprint is mapped below to its reproducible script, frozen snapshot (`snap_01`), and measured metric.

| Research Question / Claim | Script & Report Artifact | Measured Result | Honest Limitation |
|---|---|---|---|
| **RQ1**: Deployment-aware graph context + calibrated risk scoring improves prioritization over CVSS-only and EPSS-only baselines | `experiments/run_ranking.py` -> `reports/ranking_results.md` | PatchGraph achieves higher `NDCG@6` and `Precision@6` by demoting high-CVSS findings in VEX-qualified/non-production services | Measured on a curated 12-finding multi-ecosystem benchmark; confidence intervals reflect small sample size |
| **RQ2**: Constrained CP-SAT optimization removes more weighted exposure under budget than greedy risk-descending | `experiments/run_planner.py` -> `reports/planner_results.md` | At a 10.0h engineering budget, CP-SAT removes **16.70** weighted exposure (`pkg-beta` + `pkg-gamma`) vs **12.00** for greedy risk-descending (`pkg-alpha`), with `0.0000` optimality gap | When budget is unconstrained, greedy and CP-SAT converge to the same action set |
| **RQ3**: Bounded graph traversal maintains >= 80% affected-service recall under incomplete inventory | `experiments/run_graph.py` -> `reports/graph_results.md` | **100.0%** precision and **83.3%** recall (`>= 80%` target) under a 15% missing-edge deployment inventory | Unrecorded dynamic plugin loads outside the SBOM cannot be inferred by static graph edges |
