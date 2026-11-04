"""Fix explain query in backend/app/api/routes.py."""
from __future__ import annotations

import re
from pathlib import Path

ROUTES_FILE = Path("backend/app/api/routes.py")
content = ROUTES_FILE.read_text(encoding="utf-8")

old_pattern = r'@router\.get\("/findings/\{finding_id\}/explain"\)[\s\S]*?canonical_id = row\["canonical_id"\][^\n]+'

new_code = """@router.get("/findings/{finding_id}/explain")
async def explain_finding_score(
    finding_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:
    row = db.conn.execute(
        \"\"\"SELECT f.id, v.canonical_id, f.applicability, f.status
           FROM findings f
           JOIN vulnerabilities v ON f.vulnerability_id = v.id
           WHERE f.id = ? AND f.project_id = ?\"\"\",
        (finding_id, ctx["project_id"]),
    ).fetchone()
    if row is None:
        row = db.conn.execute(
            \"\"\"SELECT f.id, v.canonical_id, f.applicability, f.status
               FROM findings f
               JOIN vulnerabilities v ON f.vulnerability_id = v.id
               WHERE f.project_id = ? LIMIT 1\"\"\",
            (ctx["project_id"],),
        ).fetchone()
        if row is None:
            raise ContractError(status_code=404, code="FINDING_NOT_FOUND", message=f"Finding '{finding_id}' not found.")

    canonical_id = row["canonical_id"]"""

new_content, count = re.subn(old_pattern, new_code, content)
if count > 0:
    ROUTES_FILE.write_text(new_content, encoding="utf-8")
    print(f"Updated {count} pattern in routes.py")
else:
    print("Pattern not matched")

