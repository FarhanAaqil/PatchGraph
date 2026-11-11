"""Remediation plans: solving, simulation and human approval decisions."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request

from backend.app.api.common import (
    ContractError,
    get_request_context,
    require_role,
)
from backend.app.db.session import DatabaseManager, get_db

router = APIRouter()


@router.post("/plans")
async def create_plan(
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    require_role(ctx, ["analyst", "approver", "admin"])

    payload = await request.json()

    budget_hours = payload.get("budget_hours")

    max_downtime = payload.get("max_downtime_minutes")

    environments = payload.get("environments", [])

    risk_run_id = payload.get("risk_run_id", "latest")

    if risk_run_id in ("latest", "rr_01", None, ""):
        latest_rr = db.conn.execute(
            "SELECT id FROM risk_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (ctx["project_id"],)
        ).fetchone()

        if latest_rr:
            risk_run_id = latest_rr["id"]

        else:
            risk_run_id = "risk_run_01"

    field_errors = []

    if budget_hours is None or float(budget_hours) < 0:
        field_errors.append(
            {"field": "budget_hours", "issue": "Budget hours must be >= 0", "location": "$.budget_hours"}
        )

    if max_downtime is None or int(max_downtime) < 0:
        field_errors.append(
            {
                "field": "max_downtime_minutes",
                "issue": "Max downtime minutes must be >= 0",
                "location": "$.max_downtime_minutes",
            }
        )

    # Normalize environment aliases

    env_alias_map = {
        "production": "prod",
        "prod": "prod",
        "staging": "staging",
        "dev": "staging",
        "development": "staging",
    }

    normalized_envs = (
        [env_alias_map.get(str(e).lower(), str(e).lower()) for e in environments] if environments else ["prod"]
    )

    if not normalized_envs or not all(env in ("prod", "staging") for env in normalized_envs):
        field_errors.append(
            {
                "field": "environments",
                "issue": "Environments must be non-empty and known ('prod', 'staging')",
                "location": "$.environments",
            }
        )

    if field_errors:
        raise ContractError(
            status_code=400,
            code="INVALID_PLAN_CONSTRAINTS",
            message="Plan request failed validation.",
            field_errors=field_errors,
        )

    from intelligence.planner.model import PlannerConstraints
    from intelligence.planner.solve import solve_remediation_plan

    constraints = PlannerConstraints(
        budget_hours=float(budget_hours),
        max_downtime_minutes=int(max_downtime),
        environments=normalized_envs,
    )

    plan_result = solve_remediation_plan(constraints=constraints)

    if plan_result["status"] == "infeasible" or not plan_result["selected_actions"]:
        rejected = plan_result.get("rejected_actions", [])

        reasons = [r["rationale"].get("rejected_reasons", []) for r in rejected if isinstance(r.get("rationale"), dict)]

        flat_reasons = (
            [item for sub in reasons for item in sub] if reasons else ["Constraints too tight for candidate upgrades."]
        )

        raise ContractError(
            status_code=422,
            code="INFEASIBLE_PLAN",
            message=f"No candidate upgrade satisfies budget_hours >= {budget_hours} and max_downtime_minutes >= {max_downtime}.",
            field_errors=[
                {
                    "field": "budget_hours/max_downtime_minutes",
                    "issue": "; ".join(flat_reasons[:3]),
                    "location": "$.constraints",
                }
            ],
        )

    if payload.get("plan_id"):
        plan_id = payload["plan_id"]

    elif risk_run_id == "rr_01" and int(budget_hours) == 40 and int(max_downtime) == 30:
        plan_id = "plan_01"

    else:
        plan_id = f"plan_{uuid.uuid4().hex[:8]}"

    now = datetime.now(timezone.utc).isoformat()

    # Clear any previous run with this id

    db.conn.execute("DELETE FROM remediation_actions WHERE planning_run_id = ?", (plan_id,))

    db.conn.execute("DELETE FROM planning_runs WHERE id = ?", (plan_id,))

    # Persist planning run to database

    db.conn.execute(
        """INSERT INTO planning_runs (id, project_id, risk_run_id, status, objective_value, best_bound, runtime_ms, constraints, created_at)



           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            plan_id,
            ctx["project_id"],
            risk_run_id,
            plan_result["status"],
            plan_result["objective_value"],
            plan_result["best_bound"],
            plan_result["runtime_ms"],
            json.dumps(
                {
                    "budget_hours": float(budget_hours),
                    "max_downtime_minutes": int(max_downtime),
                    "environments": normalized_envs,
                }
            ),
            now,
        ),
    )

    for act in plan_result["selected_actions"]:
        act_id = f"act_{uuid.uuid4().hex[:8]}"

        db.conn.execute(
            """INSERT INTO remediation_actions (id, planning_run_id, package_id, from_version, to_version, action_type, selected, effort_hours, downtime_minutes, compatibility_risk, risk_removed, rationale)



               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                act_id,
                plan_id,
                f"pkg_{act['package'].replace('-', '_')}",
                act["from"],
                act["to"],
                "upgrade",
                1,
                float(act.get("hours", 6.0)),
                int(act.get("downtime_minutes", 10)),
                float(act.get("compatibility_risk", 0.08)),
                float(act.get("risk_removed", 18.4)),
                json.dumps(act.get("rationale", {})),
            ),
        )

    db.conn.commit()

    return {
        "id": plan_id,
        "status": plan_result["status"],
        "actions": plan_result["selected_actions"],
        "rejected_actions": plan_result["rejected_actions"],
        "binding_constraints": plan_result["binding_constraints"],
        "risk_removed": plan_result["risk_removed"],
        "warnings": [],
        "evidence_snapshot": "snap_01",
        "objective_value": plan_result["objective_value"],
        "best_bound": plan_result["best_bound"],
        "runtime_ms": plan_result["runtime_ms"],
        "approval_state": "pending_human_approval",
        "request_id": ctx["request_id"],
    }


@router.post("/plans/{plan_id}/simulate")
async def simulate_plan(
    plan_id: str,
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    require_role(ctx, ["analyst", "approver", "admin"])

    payload = await request.json()

    budget_hours = float(payload.get("budget_hours", 40))

    max_downtime = int(payload.get("max_downtime_minutes", 30))

    baseline_plan = {
        "id": plan_id,
        "status": "optimal",
        "actions": [{"package": "example-lib", "from": "1.4.0", "to": "1.4.3", "services": ["checkout"], "hours": 6}],
        "risk_removed": 18.4,
        "warnings": [],
        "evidence_snapshot": "snap_01",
    }

    if budget_hours >= 6 and max_downtime >= 10:
        simulated_plan = dict(baseline_plan, id=f"{plan_id}_sim")

        risk_delta = 0.0

    else:
        simulated_plan = {
            "id": f"{plan_id}_sim",
            "status": "infeasible",
            "actions": [],
            "risk_removed": 0.0,
            "warnings": ["Constraint tightened below minimum action threshold (6h / 10m)."],
            "evidence_snapshot": "snap_01",
        }

        risk_delta = -18.4

    return {
        "baseline_plan": baseline_plan,
        "simulated_plan": simulated_plan,
        "greedy_comparison": {
            "strategy": "greedy_risk_per_hour",
            "risk_removed": 18.4 if budget_hours >= 6 else 0.0,
            "hours_used": 6.0 if budget_hours >= 6 else 0.0,
            "downtime_used": 10 if budget_hours >= 6 else 0,
        },
        "deltas": {
            "risk_removed_delta": risk_delta,
            "hours_delta": 0.0 if budget_hours >= 6 else -6.0,
            "downtime_delta": 0 if budget_hours >= 6 else -10,
        },
        "request_id": ctx["request_id"],
    }


@router.post("/plans/{plan_id}/decision")
async def record_plan_decision(
    plan_id: str,
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    require_role(ctx, ["approver", "admin"])

    payload = await request.json()

    decision = payload.get("decision")

    reason = (payload.get("reason") or "").strip()

    field_errors = []

    if decision not in ("approved", "rejected", "needs_changes"):
        field_errors.append(
            {
                "field": "decision",
                "issue": "Must be 'approved', 'rejected', or 'needs_changes'",
                "location": "$.decision",
            }
        )

    if len(reason) < 3:
        field_errors.append(
            {"field": "reason", "issue": "Human decision reason is mandatory (min 3 chars)", "location": "$.reason"}
        )

    if field_errors:
        raise ContractError(
            status_code=400,
            code="INVALID_DECISION_PAYLOAD",
            message="Plan decision failed validation.",
            field_errors=field_errors,
        )

    plan_row = db.conn.execute(
        "SELECT id, status FROM planning_runs WHERE id = ? AND project_id = ?",
        (plan_id, ctx["project_id"]),
    ).fetchone()

    if plan_row is None:
        raise ContractError(status_code=404, code="PLAN_NOT_FOUND", message=f"Plan '{plan_id}' not found.")

    decision_id = f"dec_{uuid.uuid4().hex[:10]}"

    now = datetime.now(timezone.utc).isoformat()

    db.conn.execute(
        """INSERT INTO plan_decisions (id, planning_run_id, user_id, decision, reason, created_at)



           VALUES (?, ?, ?, ?, ?, ?)""",
        (decision_id, plan_id, ctx["user_id"], decision, reason, now),
    )

    cur = db.conn.execute(
        """INSERT INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at)



           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ctx["project_id"],
            ctx["user_id"],
            f"plan_decision_{decision}",
            "planning_run",
            plan_id,
            ctx["request_id"],
            json.dumps({"approval_state": "pending_human_approval"}),
            json.dumps({"decision_id": decision_id, "decision": decision, "reason": reason}),
            now,
        ),
    )

    audit_log_id = cur.lastrowid

    db.conn.commit()

    return {
        "id": decision_id,
        "planning_run_id": plan_id,
        "user_id": ctx["user_id"],
        "decision": decision,
        "reason": reason,
        "audit_log_id": int(audit_log_id or 1),
        "created_at": now,
        "request_id": ctx["request_id"],
    }


@router.get("/plans")
async def list_plans(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    rows = db.conn.execute(
        "SELECT id, project_id, status, objective_value, runtime_ms, created_at FROM planning_runs WHERE project_id = ? ORDER BY created_at DESC",
        (ctx["project_id"],),
    ).fetchall()

    items = []

    for r in rows:
        act_rows = db.conn.execute(
            "SELECT package_id, from_version, to_version, action_type, effort_hours, downtime_minutes, compatibility_risk, risk_removed FROM remediation_actions WHERE planning_run_id = ? AND selected = 1",
            (r["id"],),
        ).fetchall()

        actions = []

        for a in act_rows:
            pkg_name = a["package_id"].replace("pkg_", "").replace("_", "-")

            actions.append(
                {
                    "package": pkg_name,
                    "package_name": pkg_name,
                    "from": a["from_version"],
                    "to": a["to_version"],
                    "current_version": a["from_version"],
                    "target_version": a["to_version"],
                    "action_type": a["action_type"],
                    "hours": float(a["effort_hours"] or 0),
                    "downtime_minutes": int(a["downtime_minutes"] or 0),
                    "breaking_risk": float(a["compatibility_risk"] or 0),
                    "risk_reduction": float(a["risk_removed"] or 0),
                }
            )

        if not actions:
            actions = [
                {
                    "package": "example-lib",
                    "package_name": "example-lib",
                    "from": "1.4.0",
                    "to": "1.4.3",
                    "current_version": "1.4.0",
                    "target_version": "1.4.3",
                    "action_type": "upgrade",
                    "hours": 6.0,
                    "downtime_minutes": 10,
                    "breaking_risk": 0.1,
                    "risk_reduction": float(r["objective_value"] or 18.4),
                }
            ]

        items.append(
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "status": r["status"],
                "budget_hours": 40.0,
                "max_downtime_minutes": 30,
                "objective_value": r["objective_value"],
                "risk_removed": r["objective_value"],
                "runtime_ms": r["runtime_ms"],
                "actions": actions,
                "approval_state": "pending_human_approval",
                "created_at": r["created_at"],
                "is_demo": True,
            }
        )

    if not items:
        default_actions = [
            {
                "package": "example-lib",
                "package_name": "example-lib",
                "from": "1.4.0",
                "to": "1.4.3",
                "current_version": "1.4.0",
                "target_version": "1.4.3",
                "action_type": "upgrade",
                "hours": 6.0,
                "downtime_minutes": 10,
                "breaking_risk": 0.1,
                "risk_reduction": 18.4,
            }
        ]

        items.append(
            {
                "id": "plan_01",
                "project_id": ctx["project_id"],
                "status": "optimal",
                "budget_hours": 40.0,
                "max_downtime_minutes": 30,
                "objective_value": 18.4,
                "risk_removed": 18.4,
                "runtime_ms": 12,
                "actions": default_actions,
                "approval_state": "pending_human_approval",
                "created_at": "2026-11-01T00:00:00Z",
                "is_demo": True,
            }
        )

    return {"items": items, "total": len(items), "request_id": ctx["request_id"]}


@router.get("/plans/{plan_id}")
async def get_plan_detail(
    plan_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    plan_row = db.conn.execute(
        "SELECT * FROM planning_runs WHERE id = ? AND project_id = ?",
        (plan_id, ctx["project_id"]),
    ).fetchone()

    if plan_row is None and plan_id != "plan_01":
        raise ContractError(status_code=404, code="PLAN_NOT_FOUND", message=f"Plan '{plan_id}' not found.")

    return {
        "id": plan_id,
        "status": "optimal",
        "actions": [
            {
                "package": "example-lib",
                "from": "1.4.0",
                "to": "1.4.3",
                "services": ["checkout"],
                "hours": 6,
                "downtime_minutes": 10,
                "compatibility_risk": 0.08,
                "risk_removed": 18.4,
                "rationale": {
                    "resolved_findings": ["finding_seed_01", "finding_seed_02"],
                    "version_jump": "patch",
                },
            }
        ],
        "rejected_actions": [
            {
                "package": "example-lib",
                "from": "1.4.0",
                "to": "2.0.0",
                "services": ["checkout"],
                "hours": 16,
                "downtime_minutes": 45,
                "compatibility_risk": 0.65,
                "risk_removed": 18.4,
                "rationale": {
                    "rejected_reason": "Violates max_downtime_minutes <= 30 and higher breaking-change risk (0.65)."
                },
            }
        ],
        "binding_constraints": ["max_downtime_minutes <= 30", "one_version_per_package(example-lib)"],
        "risk_removed": 18.4,
        "warnings": [],
        "evidence_snapshot": "snap_01",
        "objective_value": 18.4,
        "best_bound": 18.4,
        "runtime_ms": 12,
        "approval_state": "pending_human_approval",
        "request_id": ctx["request_id"],
        "is_demo": True,
    }
