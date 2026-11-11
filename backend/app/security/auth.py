"""Local OIDC-compatible authentication boundary and token verifier (Day 36)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass
from typing import Optional

ROLE_ORDER = ("viewer", "analyst", "approver", "admin")

_SIGNING_KEY_ENV = "PATCHGRAPH_AUTH_SIGNING_KEY"
_ephemeral_key: Optional[str] = None


def is_production() -> bool:
    env = os.environ.get("PATCHGRAPH_ENV") or os.environ.get("ENVIRONMENT") or ""
    return env.strip().lower() in ("production", "prod")


def demo_identity_allowed() -> bool:
    """Identity headers without a token are a local-demo convenience and never allowed in production."""
    if is_production():
        return False
    return os.environ.get("PATCHGRAPH_ALLOW_DEMO_IDENTITY", "true").strip().lower() not in ("0", "false", "no")


def get_signing_key() -> str:
    """Return the token signing key from the environment.

    Production refuses to start without one. Elsewhere a random key is generated once per process,
    so there is never a key committed to the repository that could be used to forge tokens.
    """
    global _ephemeral_key
    configured = os.environ.get(_SIGNING_KEY_ENV, "").strip()
    if configured:
        return configured
    if is_production():
        raise RuntimeError(f"{_SIGNING_KEY_ENV} must be set when running in production.")
    if _ephemeral_key is None:
        _ephemeral_key = secrets.token_hex(32)
    return _ephemeral_key


def cap_role(requested: Optional[str], granted: str) -> str:
    """A caller may ask for a lower role than they hold, never a higher one."""
    if requested in ROLE_ORDER and granted in ROLE_ORDER:
        return ROLE_ORDER[min(ROLE_ORDER.index(requested), ROLE_ORDER.index(granted))]
    return granted


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
    signing_key: Optional[str] = None,
    ttl_seconds: int = 3600,
) -> str:
    signing_key = signing_key or get_signing_key()
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
    signing_key: Optional[str] = None,
    now_ts: Optional[int] = None,
) -> AuthenticatedPrincipal:
    signing_key = signing_key or get_signing_key()
    if not token or "." not in token:
        raise PermissionError("Malformed authentication token")
    body_b64, sig = token.rsplit(".", 1)
    expected_sig = hmac.new(signing_key.encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        raise PermissionError("Invalid token signature")
    try:
        payload = json.loads(base64.urlsafe_b64decode(body_b64.encode("ascii")).decode("utf-8"))
        now_val = now_ts if now_ts is not None else int(time.time())
        expired = int(payload["exp"]) < now_val
        principal = AuthenticatedPrincipal(
            sub=payload["sub"],
            email=payload["email"],
            project_id=payload["project_id"],
            role=payload["role"],
            exp=int(payload["exp"]),
        )
    except (ValueError, KeyError, TypeError) as exc:
        raise PermissionError("Malformed authentication token") from exc
    if expired:
        raise PermissionError("Authentication token has expired")
    return principal
