"""OR-Tools CP-SAT Solver & Greedy Baseline Comparator (Day 26)."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model

from intelligence.planner.candidates import CandidateAction, build_seeded_candidates
from intelligence.planner.explain import explain_rejected_actions_and_constraints
from intelligence.planner.model import SCALE, PlannerConstraints, build_cpsat_model


def solve_remediation_plan(
    candidates: Optional[List[CandidateAction]] = None,
    constraints: Optional[PlannerConstraints] = None,
) -> Dict[str, Any]:
    cand_list = candidates if candidates is not None else build_seeded_candidates()
    cons = constraints or PlannerConstraints()

    t0 = time.perf_counter()
    model, x_vars, eligible = build_cpsat_model(cand_list, cons)

    solver = cp_model.CpSolver()
    solver.parameters.random_seed = cons.solver_seed
    solver.parameters.max_time_in_seconds = cons.max_time_seconds
    solver.parameters.num_search_workers = 1  # Deterministic single-thread execution

    status_code = solver.Solve(model)
    runtime_ms = max(1, int(round((time.perf_counter() - t0) * 1000)))

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        rejected, binding = explain_rejected_actions_and_constraints(eligible, [], cons)
        return {
            "status": "infeasible",
            "selected_actions": [],
            "rejected_actions": rejected,
            "binding_constraints": binding,
            "risk_removed": 0.0,
            "effort_hours_used": 0.0,
            "downtime_minutes_used": 0,
            "compatibility_penalty": 0.0,
            "objective_value": 0.0,
            "best_bound": 0.0,
            "optimality_gap": 0.0,
            "runtime_ms": runtime_ms,
            "alternatives": [],
        }

    selected_ids = [aid for aid, var in x_vars.items() if solver.Value(var) == 1]
    if not selected_ids:
        rejected, binding = explain_rejected_actions_and_constraints(eligible, [], cons)
        return {
            "status": "infeasible",
            "selected_actions": [],
            "rejected_actions": rejected,
            "binding_constraints": binding,
            "risk_removed": 0.0,
            "effort_hours_used": 0.0,
            "downtime_minutes_used": 0,
            "compatibility_penalty": 0.0,
            "objective_value": 0.0,
            "best_bound": 0.0,
            "optimality_gap": 0.0,
            "runtime_ms": runtime_ms,
            "alternatives": [],
        }

    selected_objs = [c for c in eligible if c.action_id in selected_ids]
    selected_payload = [
        {
            "action_id": c.action_id,
            "package": c.package_name,
            "from": c.from_version,
            "to": c.to_version,
            "services": c.services,
            "hours": c.effort_hours,
            "downtime_minutes": c.downtime_minutes,
            "compatibility_risk": c.compatibility_risk,
            "risk_removed": c.risk_removed,
            "rationale": {
                "resolved_findings": c.resolved_findings,
                "action_type": c.action_type,
            },
        }
        for c in selected_objs
    ]
    rejected_payload, binding = explain_rejected_actions_and_constraints(eligible, selected_ids, cons)

    total_risk = round(sum(c.risk_removed for c in selected_objs), 2)
    total_hours = round(sum(c.effort_hours for c in selected_objs), 2)
    total_dt = sum(c.downtime_minutes for c in selected_objs)
    total_compat = round(sum(c.compatibility_risk for c in selected_objs), 4)
    obj_val = round(solver.ObjectiveValue() / SCALE, 4)
    bound_val = round(solver.BestObjectiveBound() / SCALE, 4)
    gap = round(abs(bound_val - obj_val) / max(1e-6, abs(obj_val)), 6)

    # Generate greedy alternatives for comparison
    greedy_rph = solve_greedy_baseline(eligible, cons, mode="risk_per_hour")
    greedy_desc = solve_greedy_baseline(eligible, cons, mode="risk_descending")

    return {
        "status": "optimal" if status_code == cp_model.OPTIMAL else "feasible",
        "selected_actions": selected_payload,
        "rejected_actions": rejected_payload,
        "binding_constraints": binding,
        "risk_removed": total_risk,
        "effort_hours_used": total_hours,
        "downtime_minutes_used": total_dt,
        "compatibility_penalty": total_compat,
        "objective_value": obj_val,
        "best_bound": bound_val,
        "optimality_gap": gap,
        "runtime_ms": runtime_ms,
        "alternatives": [greedy_rph, greedy_desc],
    }


def solve_greedy_baseline(
    candidates: List[CandidateAction],
    constraints: PlannerConstraints,
    mode: str = "risk_per_hour",
) -> Dict[str, Any]:
    """Deterministic greedy baseline ('risk_per_hour' or 'risk_descending')."""
    if mode == "risk_descending":
        ordered = sorted(
            candidates,
            key=lambda c: (c.risk_removed, -c.effort_hours, c.action_id),
            reverse=True,
        )
    else:
        ordered = sorted(
            candidates,
            key=lambda c: (c.risk_removed / max(0.5, c.effort_hours), c.risk_removed, c.action_id),
            reverse=True,
        )

    chosen: List[CandidateAction] = []
    chosen_pkgs = set()
    chosen_ids = set()
    hours_used = 0.0
    dt_by_service: Dict[str, int] = {}

    for c in ordered:
        if c.package_name in chosen_pkgs:
            continue
        if constraints.include_compatibility_constraints and c.compatibility_risk > constraints.max_compatibility_risk:
            continue
        if c.requires_action_id and c.requires_action_id not in chosen_ids:
            continue
        if any(inc in chosen_ids for inc in c.incompatible_with):
            continue
        if hours_used + c.effort_hours > constraints.budget_hours:
            continue
        if any(dt_by_service.get(svc, 0) + c.downtime_minutes > constraints.max_downtime_minutes for svc in c.services):
            continue

        chosen.append(c)
        chosen_pkgs.add(c.package_name)
        chosen_ids.add(c.action_id)
        hours_used += c.effort_hours
        for svc in c.services:
            dt_by_service[svc] = dt_by_service.get(svc, 0) + c.downtime_minutes

    return {
        "strategy": f"greedy_{mode}",
        "selected_action_ids": [c.action_id for c in chosen],
        "risk_removed": round(sum(c.risk_removed for c in chosen), 2),
        "effort_hours_used": round(hours_used, 2),
        "downtime_minutes_used": sum(c.downtime_minutes for c in chosen),
        "compatibility_penalty": round(sum(c.compatibility_risk for c in chosen), 4),
    }
