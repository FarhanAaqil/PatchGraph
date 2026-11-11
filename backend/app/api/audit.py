"""Append-only audit log listing and export."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from backend.app.api.common import (
    get_request_context,
)
from backend.app.db.session import DatabaseManager, get_db

router = APIRouter()


@router.get("/audit")
async def list_audit_logs(
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    where = ["project_id = ?"]
    params: List[Any] = [ctx["project_id"]]

    if action:
        where.append("action LIKE ?")
        params.append(f"%{action}%")

    if entity_type:
        where.append("entity_type = ?")
        params.append(entity_type)

    # `where` only ever holds the fixed fragments above; every user-supplied value is bound as a parameter.
    where_sql = " AND ".join(where)

    count_row = db.conn.execute(f"SELECT COUNT(*) FROM audit_logs WHERE {where_sql}", params).fetchone()
    total = count_row[0] if count_row else 0

    query = (
        "SELECT id, project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, "
        f"created_at FROM audit_logs WHERE {where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    params.extend([limit, offset])

    rows = db.conn.execute(query, params).fetchall()

    emails = {u["id"]: u["email"] for u in db.conn.execute("SELECT id, email FROM users").fetchall()}

    items = []

    for r in rows:
        items.append(
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "actor_id": r["actor_id"],
                "actor_email": emails.get(r["actor_id"], "unknown"),
                "action": r["action"],
                "entity_type": r["entity_type"],
                "entity_id": r["entity_id"],
                "request_id": r["request_id"],
                "before_state": json.loads(r["before_state"]) if r["before_state"] else None,
                "after_state": json.loads(r["after_state"]) if r["after_state"] else None,
                "created_at": r["created_at"],
                "is_demo": True,
            }
        )

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "request_id": ctx["request_id"],
    }


@router.get("/audit/export")
async def export_audit_logs(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
):

    from fastapi.responses import Response

    rows = db.conn.execute(
        "SELECT id, project_id, actor_id, action, entity_type, entity_id, request_id, before_state, after_state, created_at FROM audit_logs WHERE project_id = ? ORDER BY id ASC",
        (ctx["project_id"],),
    ).fetchall()

    if format == "csv":
        import csv
        import io

        output = io.StringIO()

        writer = csv.writer(output)

        writer.writerow(
            [
                "id",
                "project_id",
                "actor_id",
                "action",
                "entity_type",
                "entity_id",
                "request_id",
                "created_at",
                "after_state",
            ]
        )

        for r in rows:
            writer.writerow(
                [
                    r["id"],
                    r["project_id"],
                    r["actor_id"],
                    r["action"],
                    r["entity_type"],
                    r["entity_id"],
                    r["request_id"],
                    r["created_at"],
                    r["after_state"],
                ]
            )

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=patchgraph_audit_export.csv"},
        )

    export_items = [dict(r) for r in rows]

    return JSONResponse(
        content={"items": export_items, "total": len(export_items)},
        headers={"Content-Disposition": "attachment; filename=patchgraph_audit_export.json"},
    )
