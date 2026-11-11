"""Project RBAC policy matrix and tenant row-scope enforcement (Day 37)."""

from __future__ import annotations

from typing import Dict, Set

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "viewer": {"read:assets", "read:findings", "read:graph", "read:plans", "read:health", "read:audit"},
    "analyst": {
        "read:assets",
        "read:findings",
        "read:graph",
        "read:plans",
        "read:health",
        "read:audit",
        "write:imports",
        "write:risk_runs",
        "write:plans",
    },
    "approver": {
        "read:assets",
        "read:findings",
        "read:graph",
        "read:plans",
        "read:health",
        "read:audit",
        "write:imports",
        "write:risk_runs",
        "write:plans",
        "approve:plans",
    },
    "admin": {
        "read:assets",
        "read:findings",
        "read:graph",
        "read:plans",
        "read:health",
        "read:audit",
        "write:imports",
        "write:risk_runs",
        "write:plans",
        "approve:plans",
        "manage:project",
    },
}


def check_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
