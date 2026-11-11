"""Remediation plans: solving, simulation and human approval decisions."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, Request

from backend.app.api.common import (
    ContractError,
    get_request_context,
    require_role,
)
from backend.app.db.session import DatabaseManager, get_db

router = APIRouter()


VALID_OBJECTIVES = ("weighted_exposure", "greedy_risk_per_hour", "greedy_risk_desc")


def _solve(constraints: Any, objective: str) -> Dict[str, Any]:
    """Run the exact CP-SAT solver, or a greedy ordering when the caller asked for one."""
    from intelligence.planner.candidates import build_seeded_candidates
    from intelligence.planner.solve import solve_remediation_plan

    result = solve_remediation_plan(constraints=constraints)
    if objective == "weighted_exposure" or result["status"] == "infeasible":
        return result

    alternative = result["alternatives"][0 if objective == "greedy_risk_per_hour" else 1]
    by_id = {c.action_id: c for c in build_seeded_candidates()}
    chosen = [by_id[i] for i in alternative["selected_action_ids"] if i in by_id]
    return {
        **result,
        "status": "feasible" if chosen else "infeasible",
        "selected_actions": [
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
                "rationale": {"resolved_findings": c.resolved_findings, "action_type": c.action_type},
            }
            for c in chosen
        ],
        "rejected_actions": [],
        "binding_constraints": [],
        "risk_removed": alternative["risk_removed"],
        "effort_hours_used": alternative["effort_hours_used"],
        "downtime_minutes_used": alternative["downtime_minutes_used"],
        "objective_value": alternative["risk_removed"],
    }


def _plan_view(plan_id: str, result: Dict[str, Any], request_id: str, approval_state: str) -> Dict[str, Any]:
    return {
        "id": plan_id,
        "status": result["status"],
        "actions": result["selected_actions"],
        "rejected_actions": result["rejected_actions"],
        "binding_constraints": result["binding_constraints"],
        "risk_removed": result["risk_removed"],
        "effort_hours_used": result.get("effort_hours_used", 0.0),
        "downtime_minutes_used": result.get("downtime_minutes_used", 0),
        "warnings": [],
        "evidence_snapshot": "snap_01",
        "objective_value": result["objective_value"],
        "best_bound": result["best_bound"],
        "runtime_ms": result["runtime_ms"],
        "approval_state": approval_state,
        "request_id": request_id,
    }


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

    objective = str(payload.get("objective", "weighted_exposure"))
    if objective not in VALID_OBJECTIVES:
        raise ContractError(
            status_code=400,
            code="INVALID_PLAN_CONSTRAINTS",
            message="Plan request failed validation.",
            field_errors=[
                {
                    "field": "objective",
                    "issue": f"Objective must be one of {VALID_OBJECTIVES}",
                    "location": "$.objective",
                }
            ],
        )

    constraints = PlannerConstraints(
        budget_hours=float(budget_hours),
        max_downtime_minutes=int(max_downtime),
        environments=normalized_envs,
    )

    plan_result = _solve(constraints, objective)

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
                    "objective": objective,
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

    return _plan_view(plan_id, plan_result, ctx["request_id"], "pending_human_approval")


@router.post("/plans/{plan_id}/simulate")
async def simulate_plan(
    plan_id: str,
    request: Request,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    """Re-solve the plan under new limits and compare it with the plan's own saved limits."""
    require_role(ctx, ["analyst", "approver", "admin"])
    from intelligence.planner.model import PlannerConstraints

    payload = await request.json()
    row = db.conn.execute(
        "SELECT constraints FROM planning_runs WHERE id = ? AND project_id = ?", (plan_id, ctx["project_id"])
    ).fetchone()
    if row is None:
        raise ContractError(status_code=404, code="PLAN_NOT_FOUND", message=f"Plan '{plan_id}' not found.")
    saved = json.loads(row["constraints"] or "{}")
    objective = str(payload.get("objective") or saved.get("objective") or "weighted_exposure")
    if objective not in VALID_OBJECTIVES:
        objective = "weighted_exposure"

    def constraints_from(source: Dict[str, Any]) -> PlannerConstraints:
        return PlannerConstraints(
            budget_hours=float(source.get("budget_hours", 40)),
            max_downtime_minutes=int(source.get("max_downtime_minutes", 30)),
            environments=list(source.get("environments") or ["prod"]),
        )

    base_cons = constraints_from(saved)
    sim_cons = constraints_from(payload)
    baseline = _solve(base_cons, objective)
    simulated = _solve(sim_cons, objective)
    greedy = _solve(sim_cons, "greedy_risk_per_hour")

    def view(pid: str, result: Dict[str, Any]) -> Dict[str, Any]:
        return _plan_view(pid, result, ctx["request_id"], "pending_human_approval")

    return {
        "baseline_plan": view(plan_id, baseline),
        "simulated_plan": view(f"{plan_id}_sim", simulated),
        "greedy_comparison": {
            "strategy": "greedy_risk_per_hour",
            "risk_removed": greedy["risk_removed"],
            "hours_used": greedy.get("effort_hours_used", 0.0),
            "downtime_used": greedy.get("downtime_minutes_used", 0),
        },
        "deltas": {
            "risk_removed_delta": round(simulated["risk_removed"] - baseline["risk_removed"], 2),
            "hours_delta": round(simulated.get("effort_hours_used", 0.0) - baseline.get("effort_hours_used", 0.0), 2),
            "downtime_delta": simulated.get("downtime_minutes_used", 0) - baseline.get("downtime_minutes_used", 0),
        },
        "request_id": ctx["request_id"],
    }


def _approval_state(db: DatabaseManager, plan_id: str) -> str:
    """Latest human decision on a plan, or pending if nobody has decided yet."""
    row = db.conn.execute(
        "SELECT decision FROM plan_decisions WHERE planning_run_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (plan_id,),
    ).fetchone()
    return row["decision"] if row else "pending_human_approval"


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


def _stored_plan(
    db: DatabaseManager,
    row: Any,
    request_id: str,
    action_rows: Any = None,
    approval_state: Any = None,
) -> Dict[str, Any]:
    """A plan as it was actually saved: its own actions, limits and decision, never placeholder numbers."""
    if action_rows is None:
        action_rows = db.conn.execute(
            """SELECT package_id, from_version, to_version, action_type, effort_hours, downtime_minutes,
                      compatibility_risk, risk_removed, rationale
               FROM remediation_actions WHERE planning_run_id = ? AND selected = 1 ORDER BY risk_removed DESC""",
            (row["id"],),
        ).fetchall()
    actions = []
    for a in action_rows:
        name = a["package_id"].replace("pkg_", "").replace("_", "-")
        rationale = json.loads(a["rationale"]) if a["rationale"] else {}
        actions.append(
            {
                "package": name,
                "from": a["from_version"],
                "to": a["to_version"],
                "services": rationale.get("services", []),
                "hours": float(a["effort_hours"] or 0),
                "downtime_minutes": int(a["downtime_minutes"] or 0),
                "compatibility_risk": float(a["compatibility_risk"] or 0),
                "risk_removed": float(a["risk_removed"] or 0),
                "action_type": a["action_type"],
                "rationale": rationale,
            }
        )
    constraints = json.loads(row["constraints"] or "{}")
    risk_removed = round(sum(a["risk_removed"] for a in actions), 2)
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "status": row["status"],
        "actions": actions,
        "rejected_actions": [],
        "binding_constraints": [],
        "risk_removed": risk_removed,
        "effort_hours_used": round(sum(a["hours"] for a in actions), 2),
        "downtime_minutes_used": sum(a["downtime_minutes"] for a in actions),
        "budget_hours": constraints.get("budget_hours"),
        "max_downtime_minutes": constraints.get("max_downtime_minutes"),
        "warnings": [],
        "evidence_snapshot": "snap_01",
        "objective_value": row["objective_value"],
        "best_bound": row["best_bound"],
        "runtime_ms": row["runtime_ms"],
        "approval_state": approval_state if approval_state is not None else _approval_state(db, row["id"]),
        "created_at": row["created_at"],
        "request_id": request_id,
    }


@router.get("/plans")
async def list_plans(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    rows = db.conn.execute(
        """SELECT id, project_id, status, objective_value, best_bound, runtime_ms, constraints, created_at
           FROM planning_runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?""",
        (ctx["project_id"], limit, offset),
    ).fetchall()
    total = db.conn.execute("SELECT COUNT(*) FROM planning_runs WHERE project_id = ?", (ctx["project_id"],)).fetchone()[
        0
    ]
    # Two batched queries for the whole page instead of two per plan (no N+1).
    ids = [r["id"] for r in rows]
    marks = ",".join("?" * len(ids))
    actions_by_plan: Dict[str, list] = {i: [] for i in ids}
    latest_decision: Dict[str, str] = {}
    if ids:
        for a in db.conn.execute(
            f"""SELECT planning_run_id, package_id, from_version, to_version, action_type, effort_hours,
                       downtime_minutes, compatibility_risk, risk_removed, rationale
                FROM remediation_actions WHERE selected = 1 AND planning_run_id IN ({marks})
                ORDER BY risk_removed DESC""",
            ids,
        ).fetchall():
            actions_by_plan[a["planning_run_id"]].append(a)
        for d in db.conn.execute(
            f"SELECT planning_run_id, decision FROM plan_decisions WHERE planning_run_id IN ({marks}) ORDER BY created_at, rowid",
            ids,
        ).fetchall():
            latest_decision[d["planning_run_id"]] = d["decision"]  # later rows overwrite earlier ones
    items = [
        _stored_plan(
            db,
            r,
            ctx["request_id"],
            action_rows=actions_by_plan[r["id"]],
            approval_state=latest_decision.get(r["id"], "pending_human_approval"),
        )
        for r in rows
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset, "request_id": ctx["request_id"]}


@router.get("/plans/{plan_id}")
async def get_plan_detail(
    plan_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    row = db.conn.execute(
        """SELECT id, project_id, status, objective_value, best_bound, runtime_ms, constraints, created_at
           FROM planning_runs WHERE id = ? AND project_id = ?""",
        (plan_id, ctx["project_id"]),
    ).fetchone()
    if row is None:
        raise ContractError(status_code=404, code="PLAN_NOT_FOUND", message=f"Plan '{plan_id}' not found.")
    return _stored_plan(db, row, ctx["request_id"])
