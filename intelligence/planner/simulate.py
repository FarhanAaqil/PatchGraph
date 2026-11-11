"""Immutable What-If Simulation Cloner and Comparator (Day 27)."""

from __future__ import annotations

from dataclasses import replace
from typing import Any, Dict, List

from intelligence.planner.candidates import CandidateAction
from intelligence.planner.model import PlannerConstraints
from intelligence.planner.solve import solve_greedy_baseline, solve_remediation_plan


def run_what_if_simulation(
    candidates: List[CandidateAction],
    base_constraints: PlannerConstraints,
    new_budget_hours: float,
    new_max_downtime_minutes: int,
    new_environments: List[str],
) -> Dict[str, Any]:
    """Clone immutable inputs, solve under baseline and modified constraints, and compute deltas."""
    base_res = solve_remediation_plan(candidates=list(candidates), constraints=base_constraints)
    sim_constraints = replace(
        base_constraints,
        budget_hours=new_budget_hours,
        max_downtime_minutes=new_max_downtime_minutes,
        environments=list(new_environments),
    )
    sim_res = solve_remediation_plan(candidates=list(candidates), constraints=sim_constraints)
    greedy_comp = solve_greedy_baseline(list(candidates), sim_constraints, mode="risk_per_hour")

    return {
        "baseline_plan": base_res,
        "simulated_plan": sim_res,
        "greedy_comparison": greedy_comp,
        "deltas": {
            "risk_removed_delta": round(sim_res["risk_removed"] - base_res["risk_removed"], 2),
            "hours_delta": round(sim_res["effort_hours_used"] - base_res["effort_hours_used"], 2),
            "downtime_delta": sim_res["downtime_minutes_used"] - base_res["downtime_minutes_used"],
        },
    }
