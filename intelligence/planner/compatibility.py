"""Version-jump classification and compatibility constraint modeling (Day 23)."""

from __future__ import annotations

from dataclasses import dataclass

from backend.app.catalog.packages import parse_version_tuple


@dataclass(frozen=True)
class CompatibilityAssessment:
    from_version: str
    to_version: str
    jump_kind: str  # 'patch', 'minor', 'major', 'mitigation'
    compatibility_risk: float
    breaking_change_likely: bool
    rollback_note: str


def classify_version_jump(from_version: str, to_version: str) -> CompatibilityAssessment:
    f_tup = parse_version_tuple(from_version)
    t_tup = parse_version_tuple(to_version)
    if f_tup is None or t_tup is None or len(f_tup) < 2 or len(t_tup) < 2:
        return CompatibilityAssessment(
            from_version=from_version,
            to_version=to_version,
            jump_kind="mitigation",
            compatibility_risk=0.25,
            breaking_change_likely=False,
            rollback_note="Pin previous artifact digest in deployment manifest.",
        )

    if t_tup[0] > f_tup[0]:
        return CompatibilityAssessment(
            from_version=from_version,
            to_version=to_version,
            jump_kind="major",
            compatibility_risk=0.65,
            breaking_change_likely=True,
            rollback_note="Major API boundary change; requires blue-green rollback and contract suite.",
        )
    if t_tup[1] > f_tup[1]:
        return CompatibilityAssessment(
            from_version=from_version,
            to_version=to_version,
            jump_kind="minor",
            compatibility_risk=0.20,
            breaking_change_likely=False,
            rollback_note="Backward-compatible minor release; standard rolling restart rollback.",
        )
    return CompatibilityAssessment(
        from_version=from_version,
        to_version=to_version,
        jump_kind="patch",
        compatibility_risk=0.08,
        breaking_change_likely=False,
        rollback_note="Drop-in patch upgrade; revert container tag if healthcheck fails.",
    )
