"""Patch and mitigation candidate generation (Day 22)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from backend.app.planner.compatibility import classify_version_jump
from intelligence.planner.effort import estimate_action_effort


@dataclass(frozen=True)
class CandidateAction:
    action_id: str
    package_name: str
    from_version: str
    to_version: str
    action_type: str  # 'upgrade', 'major_upgrade', 'mitigation'
    services: List[str]
    environments: List[str]
    effort_hours: float
    downtime_minutes: int
    compatibility_risk: float
    risk_removed: float
    coverage_bonus: float
    urgency_bonus: float
    resolved_findings: List[str] = field(default_factory=list)
    requires_action_id: Optional[str] = None
    incompatible_with: List[str] = field(default_factory=list)
    is_critical_service: bool = True


def build_seeded_candidates() -> List[CandidateAction]:
    """Generate candidate upgrade and mitigation actions for the seeded commerce-platform scenario."""
    patch_compat = classify_version_jump("1.4.0", "1.4.3")
    patch_effort = estimate_action_effort(patch_compat.jump_kind, affected_service_count=1)

    major_compat = classify_version_jump("1.4.0", "2.0.0")
    major_effort = estimate_action_effort(major_compat.jump_kind, affected_service_count=1)

    urllib_compat = classify_version_jump("2.0.2", "2.0.7")
    urllib_effort = estimate_action_effort(urllib_compat.jump_kind, affected_service_count=1)

    return [
        CandidateAction(
            action_id="act_example_lib_patch_1_4_3",
            package_name="example-lib",
            from_version="1.4.0",
            to_version="1.4.3",
            action_type="upgrade",
            services=["checkout"],
            environments=["prod"],
            effort_hours=patch_effort.effort_hours,
            downtime_minutes=patch_effort.downtime_minutes,
            compatibility_risk=patch_compat.compatibility_risk,
            risk_removed=18.4,
            coverage_bonus=1.5,
            urgency_bonus=2.0,
            resolved_findings=["finding_seed_01", "finding_seed_02"],
            incompatible_with=["act_example_lib_major_2_0_0"],
            is_critical_service=True,
        ),
        CandidateAction(
            action_id="act_example_lib_major_2_0_0",
            package_name="example-lib",
            from_version="1.4.0",
            to_version="2.0.0",
            action_type="major_upgrade",
            services=["checkout"],
            environments=["prod"],
            effort_hours=major_effort.effort_hours,
            downtime_minutes=major_effort.downtime_minutes,
            compatibility_risk=major_compat.compatibility_risk,
            risk_removed=18.4,
            coverage_bonus=1.5,
            urgency_bonus=2.0,
            resolved_findings=["finding_seed_01", "finding_seed_02"],
            incompatible_with=["act_example_lib_patch_1_4_3"],
            is_critical_service=True,
        ),
        CandidateAction(
            action_id="act_urllib3_patch_2_0_7",
            package_name="urllib3",
            from_version="2.0.2",
            to_version="2.0.7",
            action_type="upgrade",
            services=["checkout"],
            environments=["prod"],
            effort_hours=4.0,
            downtime_minutes=5,
            compatibility_risk=urllib_compat.compatibility_risk,
            risk_removed=4.2,
            coverage_bonus=0.5,
            urgency_bonus=0.2,
            resolved_findings=["finding_urllib3_01"],
            is_critical_service=True,
        ),
    ]
