"""Shared API plumbing: the error envelope, upload limits and the request-context dependency."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import Depends, Header, Request

from backend.app.db.session import DatabaseManager, get_db
from backend.app.security.auth import cap_role, demo_identity_allowed, verify_local_oidc_token

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB cap per upload
MAX_JSON_DEPTH = 64
DEMO_PROJECT_ID = "00000000-0000-0000-0000-000000000001"
DEMO_USER_ID = "00000000-0000-0000-0000-000000000010"


class ContractError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field_errors: Optional[List[Dict[str, str]]] = None,
    ) -> None:

        super().__init__(message)

        self.status_code = status_code

        self.code = code

        self.message = message

        self.field_errors = field_errors or []


def compute_json_depth(obj: Any, current: int = 0) -> int:

    if current > MAX_JSON_DEPTH:
        return current

    if isinstance(obj, dict):
        if not obj:
            return current + 1

        return max(compute_json_depth(v, current + 1) for v in obj.values())

    if isinstance(obj, list):
        if not obj:
            return current + 1

        return max(compute_json_depth(v, current + 1) for v in obj)

    return current


def get_request_context(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_project_id: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, str]:
    """Resolve who is calling and what they may do.

    A signed bearer token is the real credential. Plain identity headers are only honoured while
    demo identity is enabled (never in production), and in both cases the role comes from the
    project membership table. `X-User-Role` can narrow that role but can never raise it.
    """
    request_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}")

    if authorization:
        scheme, _, credential = authorization.partition(" ")
        if scheme.lower() != "bearer" or not credential:
            raise ContractError(status_code=401, code="UNAUTHORIZED", message="Authorization must be a Bearer token.")
        try:
            principal = verify_local_oidc_token(credential.strip())
        except PermissionError as exc:
            raise ContractError(status_code=401, code="UNAUTHORIZED", message=str(exc)) from exc
        project_id, user_id = principal.project_id, principal.sub
        requested_role = principal.role
    elif demo_identity_allowed():
        project_id = x_project_id or DEMO_PROJECT_ID
        user_id = x_user_id or DEMO_USER_ID
        requested_role = x_user_role
    else:
        raise ContractError(
            status_code=401,
            code="UNAUTHORIZED",
            message="A Bearer token is required.",
        )

    row = db.conn.execute(
        "SELECT role FROM memberships WHERE project_id = ? AND user_id = ?",
        (project_id, user_id),
    ).fetchone()

    if row is None:
        raise ContractError(
            status_code=403,
            code="FORBIDDEN_PROJECT_SCOPE",
            message=f"User {user_id} is not a member of project {project_id}.",
        )

    return {
        "request_id": request_id,
        "project_id": project_id,
        "user_id": user_id,
        "role": cap_role(requested_role, row["role"]),
    }


def require_role(ctx: Dict[str, str], allowed: List[str]) -> None:

    if ctx["role"] not in allowed:
        raise ContractError(
            status_code=403,
            code="INSUFFICIENT_ROLE",
            message=f"Role '{ctx['role']}' is not permitted; required one of {allowed}.",
        )
