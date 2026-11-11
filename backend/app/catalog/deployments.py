"""Deployment context mapping for applications, services, assets, and environments (Day 15).

Parses CSV/JSON deployment mappings and queries deployment context per service/environment.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Any, Dict, List

from backend.app.db.session import DatabaseManager


@dataclass(frozen=True)
class ServiceDeploymentContext:
    service_id: str
    service_name: str
    application_name: str
    criticality: int
    environment: str
    production: bool
    max_downtime_minutes: int
    owner_email: str
    asset_keys: List[str]


def parse_deployment_csv(csv_text: str) -> List[Dict[str, Any]]:
    """Parse CSV mapping for service, asset, environment, owner, criticality, and allowed downtime."""
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    records: List[Dict[str, Any]] = []
    for idx, row in enumerate(reader):
        crit = int(row["criticality"])
        downtime = int(row["max_downtime_minutes"])
        if not (1 <= crit <= 5):
            raise ValueError(f"Row {idx}: criticality {crit} must be between 1 and 5")
        if downtime < 0:
            raise ValueError(f"Row {idx}: max_downtime_minutes {downtime} must be >= 0")
        records.append(
            {
                "application": row["application"].strip(),
                "service": row["service"].strip(),
                "asset_key": row["asset_key"].strip(),
                "environment": row["environment"].strip(),
                "production": row["production"].strip().lower() in ("true", "1", "yes"),
                "owner_email": row["owner_email"].strip(),
                "criticality": crit,
                "max_downtime_minutes": downtime,
            }
        )
    return records


def get_project_deployment_contexts(db: DatabaseManager, project_id: str) -> Dict[str, ServiceDeploymentContext]:
    rows = db.conn.execute(
        """SELECT s.id AS service_id, s.name AS service_name, s.owner_email,
                  a.name AS app_name, a.criticality AS app_crit,
                  e.name AS env_name, e.production, e.max_downtime_minutes,
                  ast.external_key AS asset_key
           FROM services s
           JOIN applications a ON s.application_id = a.id
           LEFT JOIN deployments d ON d.service_id = s.id
           LEFT JOIN assets ast ON d.asset_id = ast.id
           LEFT JOIN environments e ON ast.environment_id = e.id
           WHERE a.project_id = ?""",
        (project_id,),
    ).fetchall()

    by_service: Dict[str, ServiceDeploymentContext] = {}
    for r in rows:
        sname = r["service_name"]
        if sname in by_service:
            if r["asset_key"] and r["asset_key"] not in by_service[sname].asset_keys:
                by_service[sname].asset_keys.append(r["asset_key"])
            continue
        by_service[sname] = ServiceDeploymentContext(
            service_id=r["service_id"],
            service_name=sname,
            application_name=r["app_name"],
            criticality=int(r["app_crit"]),
            environment=r["env_name"] or "staging",
            production=bool(r["production"]),
            max_downtime_minutes=int(r["max_downtime_minutes"] if r["max_downtime_minutes"] is not None else 60),
            owner_email=r["owner_email"] or "unassigned@patchgraph.local",
            asset_keys=[r["asset_key"]] if r["asset_key"] else [],
        )
    return by_service
