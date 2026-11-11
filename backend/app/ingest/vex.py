"""OpenVEX and CycloneDX VEX validation and non-destructive status resolution (Day 29).

Data invariant (`03_TRD_PatchGraph.md`):
VEX never deletes a match; it qualifies status (`affected`, `not_affected`, `fixed`,
`under_investigation`) with explicit product mapping and justification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.app.db.session import DatabaseManager

ALLOWED_VEX_STATUSES = {"affected", "not_affected", "fixed", "under_investigation"}
REQUIRED_JUSTIFICATIONS_FOR_NOT_AFFECTED = {
    "component_not_present",
    "vulnerable_code_not_present",
    "vulnerable_code_not_in_execute_path",
    "vulnerable_code_cannot_be_controlled_by_adversary",
    "inline_mitigations_already_exist",
}


@dataclass(frozen=True)
class ParsedVexStatement:
    cve_id: str
    product_purl: str
    service_scope: Optional[str]
    status: str
    justification: Optional[str]
    action_statement: Optional[str]


@dataclass
class ValidatedVexDocument:
    statements: List[ParsedVexStatement] = field(default_factory=list)
    errors: List[Dict[str, str]] = field(default_factory=list)


def validate_and_parse_vex(document: Dict[str, Any]) -> ValidatedVexDocument:
    errors: List[Dict[str, str]] = []
    raw_stmts = document.get("statements")
    if not isinstance(raw_stmts, list) or not raw_stmts:
        return ValidatedVexDocument(
            errors=[
                {
                    "field": "statements",
                    "issue": "VEX document requires non-empty statements array",
                    "location": "$.statements",
                }
            ]
        )

    parsed: List[ParsedVexStatement] = []
    for idx, st in enumerate(raw_stmts):
        loc = f"$.statements[{idx}]"
        vuln_name = (st.get("vulnerability") or {}).get("name")
        status = st.get("status")
        justification = st.get("justification")
        action_stmt = st.get("action_statement")
        products = st.get("products") or []

        if not vuln_name:
            errors.append(
                {
                    "field": "vulnerability.name",
                    "issue": "Missing vulnerability name",
                    "location": f"{loc}.vulnerability",
                }
            )
            continue
        if status not in ALLOWED_VEX_STATUSES:
            errors.append({"field": "status", "issue": f"Invalid VEX status '{status}'", "location": f"{loc}.status"})
            continue
        if status == "not_affected" and justification not in REQUIRED_JUSTIFICATIONS_FOR_NOT_AFFECTED:
            errors.append(
                {
                    "field": "justification",
                    "issue": "status='not_affected' requires a standard OpenVEX justification",
                    "location": f"{loc}.justification",
                }
            )
            continue
        if not products:
            errors.append(
                {
                    "field": "products",
                    "issue": "VEX statement requires explicit product mapping",
                    "location": f"{loc}.products",
                }
            )
            continue

        for p_obj in products:
            prod_id = p_obj.get("@id") or ""
            sub_svcs = [
                s.get("@id", "").replace("service:", "") for s in (p_obj.get("subcomponents") or []) if s.get("@id")
            ]
            target_services = sub_svcs if sub_svcs else [None]
            for svc in target_services:
                parsed.append(
                    ParsedVexStatement(
                        cve_id=vuln_name,
                        product_purl=prod_id,
                        service_scope=svc,
                        status=status,
                        justification=justification,
                        action_statement=action_stmt,
                    )
                )

    return ValidatedVexDocument(statements=parsed, errors=errors)


def apply_vex_statements_non_destructively(
    db: DatabaseManager,
    project_id: str,
    validated_vex: ValidatedVexDocument,
) -> Dict[str, int]:
    """Qualify finding applicability in-place without deleting any finding rows."""
    cur = db.conn.cursor()
    before_count = cur.execute("SELECT COUNT(*) AS c FROM findings WHERE project_id = ?", (project_id,)).fetchone()["c"]
    updated = 0

    for stmt in validated_vex.statements:
        vuln_row = cur.execute("SELECT id FROM vulnerabilities WHERE canonical_id = ?", (stmt.cve_id,)).fetchone()
        if not vuln_row:
            continue
        if stmt.service_scope:
            svc_row = cur.execute("SELECT id FROM services WHERE name = ?", (stmt.service_scope,)).fetchone()
            if svc_row:
                cur.execute(
                    "UPDATE findings SET applicability = ? WHERE project_id = ? AND vulnerability_id = ? AND service_id = ?",
                    (stmt.status, project_id, vuln_row["id"], svc_row["id"]),
                )
                updated += cur.rowcount
        else:
            cur.execute(
                "UPDATE findings SET applicability = ? WHERE project_id = ? AND vulnerability_id = ?",
                (stmt.status, project_id, vuln_row["id"]),
            )
            updated += cur.rowcount

    db.conn.commit()
    after_count = cur.execute("SELECT COUNT(*) AS c FROM findings WHERE project_id = ?", (project_id,)).fetchone()["c"]
    return {
        "findings_before": before_count,
        "findings_after": after_count,
        "findings_qualified": updated,
    }
