"""Initial PatchGraph schema v1 (001_core)

Revision ID: 001_core
Revises: None
Create Date: 2026-11-02 00:00:00
"""
from pathlib import Path

revision = "001_core"
down_revision = None
branch_labels = None
depends_on = None


def get_core_sql() -> str:
    sql_path = Path(__file__).resolve().parent.parent / "001_core.sql"
    return sql_path.read_text(encoding="utf-8")


def upgrade(op=None) -> None:
    sql = get_core_sql()
    if op is not None:
        op.execute(sql)


def downgrade(op=None) -> None:
    tables = [
        "audit_logs",
        "plan_decisions",
        "remediation_actions",
        "planning_runs",
        "finding_scores",
        "risk_runs",
        "findings",
        "evidence_snapshots",
        "vex_statements",
        "exploit_evidence",
        "affected_ranges",
        "advisories",
        "vulnerabilities",
        "deployments",
        "service_components",
        "dependencies",
        "imports",
        "package_versions",
        "packages",
        "assets",
        "environments",
        "services",
        "applications",
        "memberships",
        "users",
        "projects",
    ]
    if op is not None:
        for t in tables:
            op.execute(f"DROP TABLE IF EXISTS {t} CASCADE;")
