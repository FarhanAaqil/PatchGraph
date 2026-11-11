"""Local OIDC-compatible authentication boundary and token verifier (Day 36)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    sub: str
    email: str
    project_id: str
    role: str
    exp: int


def issue_local_oidc_token(
    user_id: str,
    email: str,
    project_id: str,
    role: str,
    signing_key: str = "patchgraph-local-oidc-dev-key",
    ttl_seconds: int = 3600,
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "project_id": project_id,
        "role": role,
        "exp": int(time.time()) + ttl_seconds,
    }
    body_b64 = base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode("utf-8")).decode("ascii")
    sig = hmac.new(signing_key.encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body_b64}.{sig}"


def verify_local_oidc_token(
    token: str,
    signing_key: str = "patchgraph-local-oidc-dev-key",
    now_ts: Optional[int] = None,
) -> AuthenticatedPrincipal:
    if not token or "." not in token:
        raise PermissionError("Malformed authentication token")
    body_b64, sig = token.rsplit(".", 1)
    expected_sig = hmac.new(signing_key.encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        raise PermissionError("Invalid token signature")
    payload = json.loads(base64.urlsafe_b64decode(body_b64.encode("ascii")).decode("utf-8"))
    now_val = now_ts if now_ts is not None else int(time.time())
    if int(payload["exp"]) < now_val:
        raise PermissionError("Authentication token has expired")
    return AuthenticatedPrincipal(
        sub=payload["sub"],
        email=payload["email"],
        project_id=payload["project_id"],
        role=payload["role"],
        exp=int(payload["exp"]),
    )
