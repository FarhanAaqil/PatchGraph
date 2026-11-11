"""Explainability serializer for selected/rejected remediation actions and binding constraints (Day 26)."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from intelligence.planner.candidates import CandidateAction
from intelligence.planner.model import PlannerConstraints


def explain_rejected_actions_and_constraints(
    eligible: List[CandidateAction],
    selected_ids: List[str],
    constraints: PlannerConstraints,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    selected_set = set(selected_ids)
    selected_pkgs = {c.package_name for c in eligible if c.action_id in selected_set}
    total_hours_used = sum(c.effort_hours for c in eligible if c.action_id in selected_set)
    total_dt_used = sum(c.downtime_minutes for c in eligible if c.action_id in selected_set)

    rejected_list: List[Dict[str, Any]] = []
    binding: List[str] = []

    for c in eligible:
        if c.action_id in selected_set:
            continue
        reasons: List[str] = []
        if c.downtime_minutes > constraints.max_downtime_minutes:
            reasons.append(
                f"Downtime {c.downtime_minutes}m exceeds max_downtime_minutes={constraints.max_downtime_minutes}m"
            )
            if f"max_downtime_minutes <= {constraints.max_downtime_minutes}" not in binding:
                binding.append(f"max_downtime_minutes <= {constraints.max_downtime_minutes}")
        if constraints.include_compatibility_constraints and c.compatibility_risk > constraints.max_compatibility_risk:
            reasons.append(
                f"Compatibility risk {c.compatibility_risk:.2f} exceeds ceiling {constraints.max_compatibility_risk:.2f}"
            )
            if f"compatibility_risk <= {constraints.max_compatibility_risk:.2f}" not in binding:
                binding.append(f"compatibility_risk <= {constraints.max_compatibility_risk:.2f}")
        if c.package_name in selected_pkgs:
            reasons.append(f"Mutually exclusive with higher-utility version selected for {c.package_name}")
            if f"one_version_per_package({c.package_name})" not in binding:
                binding.append(f"one_version_per_package({c.package_name})")
        if total_hours_used + c.effort_hours > constraints.budget_hours:
            reasons.append(
                f"Requires {c.effort_hours}h (remaining budget {max(0.0, constraints.budget_hours - total_hours_used):.1f}h)"
            )
            if f"budget_hours <= {constraints.budget_hours}" not in binding:
                binding.append(f"budget_hours <= {constraints.budget_hours}")
        if total_dt_used + c.downtime_minutes > constraints.max_downtime_minutes:
            reasons.append(
                f"Cumulative service downtime ({total_dt_used + c.downtime_minutes}m) would exceed {constraints.max_downtime_minutes}m"
            )
            if f"max_downtime_minutes <= {constraints.max_downtime_minutes}" not in binding:
                binding.append(f"max_downtime_minutes <= {constraints.max_downtime_minutes}")

        if not reasons:
            reasons.append("Not selected under current objective weights or critical-service change limit.")

        rejected_list.append(
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
                "rationale": {"rejected_reasons": reasons},
            }
        )

    return rejected_list, binding
