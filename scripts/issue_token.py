"""Mint a signed bearer token for a project member.

Usage:
    PATCHGRAPH_AUTH_SIGNING_KEY=... python scripts/issue_token.py <user_id> <email> <project_id> <role> [ttl_seconds]

The role in the token is only a ceiling: the API still checks the user's project membership and uses
whichever of the two roles is lower.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.security.auth import ROLE_ORDER, issue_local_oidc_token


def main(argv: list[str]) -> None:
    if len(argv) not in (5, 6) or argv[4] not in ROLE_ORDER:
        raise SystemExit(__doc__)
    ttl = int(argv[5]) if len(argv) == 6 else 3600
    print(issue_local_oidc_token(argv[1], argv[2], argv[3], argv[4], ttl_seconds=ttl))


if __name__ == "__main__":
    main(sys.argv)
