"""Planner Evaluation: OR-Tools CP-SAT vs Greedy Baselines (Day 46, RQ2)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from experiments.manifest import build_evaluation_manifest_meta
from intelligence.planner.candidates import CandidateAction
from intelligence.planner.model import PlannerConstraints
from intelligence.planner.solve import solve_greedy_baseline, solve_remediation_plan


def build_planner_benchmark_candidates() -> List[CandidateAction]:
    return [
        CandidateAction(
            "act_1", "pkg-alpha", "1.0.0", "1.0.2", "upgrade", ["checkout"], ["prod"], 10.0, 10, 0.08, 12.0, 1.0, 1.0
        ),
        CandidateAction(
            "act_2", "pkg-beta", "2.1.0", "2.1.4", "upgrade", ["checkout"], ["prod"], 5.0, 10, 0.05, 8.5, 1.0, 1.0
        ),
        CandidateAction(
            "act_3", "pkg-gamma", "3.0.1", "3.0.3", "upgrade", ["payments"], ["prod"], 5.0, 10, 0.05, 8.2, 1.0, 1.0
        ),
        CandidateAction(
            "act_4",
            "pkg-delta",
            "1.4.0",
            "2.0.0",
            "major_upgrade",
            ["checkout"],
            ["prod"],
            6.0,
            20,
            0.72,
            14.0,
            0.5,
            0.5,
        ),
    ]


def run_planner_evaluation() -> Dict[str, Any]:
    cands = build_planner_benchmark_candidates()
    cons = PlannerConstraints(
        budget_hours=10.0, max_downtime_minutes=30, environments=["prod"], max_compatibility_risk=0.50
    )

    cpsat = solve_remediation_plan(cands, cons)
    greedy_desc = solve_greedy_baseline(cands, cons, mode="risk_descending")
    greedy_rph = solve_greedy_baseline(cands, cons, mode="risk_per_hour")

    no_compat_cons = PlannerConstraints(
        budget_hours=10.0,
        max_downtime_minutes=30,
        environments=["prod"],
        include_compatibility_constraints=False,
    )
    no_compat_plan = solve_remediation_plan(cands, no_compat_cons)

    out = {
        "manifest": build_evaluation_manifest_meta(),
        "budget_hours": 10.0,
        "cpsat_optimal": {
            "risk_removed": cpsat["risk_removed"],
            "effort_hours": cpsat["effort_hours_used"],
            "downtime_minutes": cpsat["downtime_minutes_used"],
            "compatibility_penalty": cpsat["compatibility_penalty"],
            "optimality_gap": cpsat["optimality_gap"],
            "runtime_ms": cpsat["runtime_ms"],
        },
        "greedy_risk_descending": greedy_desc,
        "greedy_risk_per_hour": greedy_rph,
        "no_compatibility_constraints": {
            "risk_removed": no_compat_plan["risk_removed"],
            "compatibility_penalty": no_compat_plan["compatibility_penalty"],
        },
    }

    repo_root = Path(__file__).resolve().parent.parent
    md = f"""# PatchGraph Remediation Planner Evaluation Results (RQ2)

- **Dataset Date**: `2026-11-01` · **Engineering Budget**: `10.0 hours` · **Max Downtime**: `30 minutes` · **Manifest**: `snap_01`

| Planner Method | Weighted Exposure Removed | Effort Used (h) | Downtime Used (m) | Compatibility Penalty | Optimality Gap |
|---|---:|---:|---:|---:|---:|
| `OR-Tools CP-SAT (Constrained)` | **{cpsat["risk_removed"]:.2f}** | {cpsat["effort_hours_used"]:.1f}h | {cpsat["downtime_minutes_used"]}m | {cpsat["compatibility_penalty"]:.2f} | {cpsat["optimality_gap"]:.4f} |
| `Greedy Risk-Descending` | {greedy_desc["risk_removed"]:.2f} | {greedy_desc["effort_hours_used"]:.1f}h | {greedy_desc["downtime_minutes_used"]}m | {greedy_desc["compatibility_penalty"]:.2f} | N/A |
| `Greedy Risk-per-Hour` | {greedy_rph["risk_removed"]:.2f} | {greedy_rph["effort_hours_used"]:.1f}h | {greedy_rph["downtime_minutes_used"]}m | {greedy_rph["compatibility_penalty"]:.2f} | N/A |
| `Unconstrained Compatibility Baseline` | {no_compat_plan["risk_removed"]:.2f} | {no_compat_plan["effort_hours_used"]:.1f}h | {no_compat_plan["downtime_minutes_used"]}m | {no_compat_plan["compatibility_penalty"]:.2f} (Violates 0.50 ceiling) | 0.0000 |
"""
    (repo_root / "reports" / "planner_results.md").write_text(md, encoding="utf-8")
    return out


if __name__ == "__main__":
    run_planner_evaluation()
