"""OR-Tools CP-SAT Optimization Model Builder for Constrained Remediation Planning (Day 25).

Formulation per `PatchGraph Master Blueprint.docx` and `29_Remediation_Optimization_Strategy.md`:
  max sum_a x_a * (risk_removed_a + coverage_a + urgency_a
                   - w_eff * effort_a - w_dt * downtime_a - w_compat * compat_risk_a - w_conc * concentration_a)
  subject to:
  1. Total engineering hours <= budget_hours
  2. Per-service downtime <= max_downtime_minutes
  3. At most one chosen target version per package (`sum_{a in Pkg(p)} x_a <= 1`)
  4. Upgrade precedence (`x_a <= x_pred`)
  5. Incompatible action pairs (`x_a + x_b <= 1`)
  6. Critical-service simultaneous change limit (`sum_{a in Crit} x_a <= max_critical_changes`)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from ortools.sat.python import cp_model

from intelligence.planner.candidates import CandidateAction


@dataclass(frozen=True)
class PlannerConstraints:
    budget_hours: float = 40.0
    max_downtime_minutes: int = 30
    environments: List[str] = field(default_factory=lambda: ["prod"])
    max_compatibility_risk: float = 0.50
    max_critical_service_actions: int = 2
    solver_seed: int = 42
    max_time_seconds: float = 5.0
    include_compatibility_constraints: bool = True


SCALE = 100  # Integer scaling factor for CP-SAT linear coefficients


def build_cpsat_model(
    candidates: List[CandidateAction],
    constraints: PlannerConstraints,
) -> Tuple[cp_model.CpModel, Dict[str, cp_model.IntVar], List[CandidateAction]]:
    model = cp_model.CpModel()
    eligible = [c for c in candidates if any(env in constraints.environments for env in c.environments)]

    x_vars: Dict[str, cp_model.IntVar] = {}
    for c in eligible:
        x_vars[c.action_id] = model.NewBoolVar(f"x_{c.action_id}")

    # 1. Total engineering effort hours budget (scaled by 10 to support 0.1h increments)
    model.Add(
        sum(int(round(c.effort_hours * 10)) * x_vars[c.action_id] for c in eligible)
        <= int(round(constraints.budget_hours * 10))
    )

    # 2. Per-action and per-service downtime limit
    by_service: Dict[str, List[CandidateAction]] = {}
    for c in eligible:
        if c.downtime_minutes > constraints.max_downtime_minutes:
            model.Add(x_vars[c.action_id] == 0)
        for svc in c.services:
            by_service.setdefault(svc, []).append(c)

    for svc_actions in by_service.values():
        model.Add(
            sum(c.downtime_minutes * x_vars[c.action_id] for c in svc_actions) <= constraints.max_downtime_minutes
        )

    # 3. At most one chosen version per package
    by_pkg: Dict[str, List[CandidateAction]] = {}
    for c in eligible:
        by_pkg.setdefault(c.package_name, []).append(c)
    for pkg_actions in by_pkg.values():
        if len(pkg_actions) > 1:
            model.Add(sum(x_vars[c.action_id] for c in pkg_actions) <= 1)

    # 4. Upgrade precedence constraints
    for c in eligible:
        if c.requires_action_id and c.requires_action_id in x_vars:
            model.Add(x_vars[c.action_id] <= x_vars[c.requires_action_id])

    # 5. Incompatible action pairs & compatibility risk ceiling
    if constraints.include_compatibility_constraints:
        for c in eligible:
            if c.compatibility_risk > constraints.max_compatibility_risk:
                model.Add(x_vars[c.action_id] == 0)
            for inc_id in c.incompatible_with:
                if inc_id in x_vars and c.action_id < inc_id:
                    model.Add(x_vars[c.action_id] + x_vars[inc_id] <= 1)

    # 6. Critical-service change concentration limit
    crit_actions = [c for c in eligible if c.is_critical_service]
    if crit_actions:
        model.Add(sum(x_vars[c.action_id] for c in crit_actions) <= constraints.max_critical_service_actions)

    # Objective: maximize net weighted benefit
    objective_terms = []
    for c in eligible:
        net_val = (
            c.risk_removed
            + 0.25 * c.coverage_bonus
            + 0.25 * c.urgency_bonus
            - 0.08 * c.effort_hours
            - 0.02 * c.downtime_minutes
            - 2.0 * c.compatibility_risk
        )
        coeff = int(round(net_val * SCALE))
        objective_terms.append(coeff * x_vars[c.action_id])

    model.Maximize(sum(objective_terms))
    return model, x_vars, eligible
