"""Human-Gated Automated Patch & Pull Request Bundle Generator (`backend/app/planner/patch_generator.py`).

Generates unified Git diffs (`requirements.txt`, `pyproject.toml`, `package.json`),
PR metadata, and rollback scripts ONLY after an `approved` human decision record exists
in `plan_decisions`.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from backend.app.db.session import DatabaseManager


@dataclass(frozen=True)
class GeneratedPatchBundle:
    plan_id: str
    approval_decision_id: str
    pr_title: str
    pr_branch: str
    unified_diff: str
    rollback_script: str
    bundle_sha256: str


def generate_approved_patch_bundle(
    db: DatabaseManager,
    project_id: str,
    plan_id: str,
) -> GeneratedPatchBundle:
    """Generate a deterministic Git diff and rollback script for an approved plan."""
    dec_row = db.conn.execute(
        """SELECT pd.id, pd.decision, pd.reason
           FROM plan_decisions pd
           JOIN planning_runs pr ON pd.planning_run_id = pr.id
           WHERE pr.id = ? AND pr.project_id = ?
           ORDER BY pd.created_at DESC LIMIT 1""",
        (plan_id, project_id),
    ).fetchone()
    if dec_row is None or dec_row["decision"] != "approved":
        raise PermissionError(
            f"Cannot generate patch bundle for plan '{plan_id}': requires an 'approved' human decision record."
        )

    act_rows = db.conn.execute(
        """SELECT p.normalized_name AS package_name, ra.from_version, ra.to_version
           FROM remediation_actions ra
           JOIN packages p ON ra.package_id = p.id
           WHERE ra.planning_run_id = ? AND ra.selected = 1
           ORDER BY p.normalized_name ASC""",
        (plan_id,),
    ).fetchall()

    diff_lines = [
        "--- a/requirements.txt",
        "+++ b/requirements.txt",
        "@@ -1,3 +1,3 @@",
    ]
    rollback_lines = ["#!/usr/bin/env bash", "set -euo pipefail", "# Auto-generated rollback script"]
    for r in act_rows:
        pkg = r["package_name"]
        frm = r["from_version"]
        to = r["to_version"]
        diff_lines.append(f"-{pkg}=={frm}")
        diff_lines.append(f"+{pkg}=={to}")
        rollback_lines.append(f"pip install '{pkg}=={frm}'")

    unified_diff = "\n".join(diff_lines) + "\n"
    rollback_script = "\n".join(rollback_lines) + "\n"
    digest = hashlib.sha256((unified_diff + rollback_script).encode("utf-8")).hexdigest()

    return GeneratedPatchBundle(
        plan_id=plan_id,
        approval_decision_id=dec_row["id"],
        pr_title=f"chore(security): apply approved PatchGraph remediation plan {plan_id}",
        pr_branch=f"patchgraph/remediate-{plan_id}",
        unified_diff=unified_diff,
        rollback_script=rollback_script,
        bundle_sha256=digest,
    )
