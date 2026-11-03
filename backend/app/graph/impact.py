"""Blast-radius impact aggregation across services, environments, and owners (Day 17)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from backend.app.graph.build import TypedSupplyChainGraph
from backend.app.graph.traverse import AffectedPathRecord, traverse_affected_paths


@dataclass(frozen=True)
class BlastRadiusSummary:
    package_version_id: str
    total_affected_services: int
    production_services: List[str]
    non_production_services: List[str]
    owners: List[str]
    max_decay_factor: float
    cycle_detected: bool
    paths: List[AffectedPathRecord]


def compute_blast_radius(
    graph: TypedSupplyChainGraph,
    package_version_id: str,
    max_depth: int = 6,
    vex_overrides: Optional[Dict[Tuple[str, str], str]] = None,
) -> BlastRadiusSummary:
    paths, cycle_detected = traverse_affected_paths(
        graph,
        package_version_id=package_version_id,
        max_depth=max_depth,
        vex_overrides=vex_overrides,
    )
    prod_svcs: List[str] = []
    non_prod_svcs: List[str] = []
    owners: List[str] = []

    for p in paths:
        if p.reachability_state == "unreachable_vex":
            continue
        if p.production and p.service_name not in prod_svcs:
            prod_svcs.append(p.service_name)
        elif not p.production and p.service_name not in non_prod_svcs:
            non_prod_svcs.append(p.service_name)
        if p.owner_email not in owners:
            owners.append(p.owner_email)

    max_decay = max((p.decay_factor for p in paths if p.reachability_state != "unreachable_vex"), default=0.0)
    return BlastRadiusSummary(
        package_version_id=package_version_id,
        total_affected_services=len(prod_svcs) + len(non_prod_svcs),
        production_services=prod_svcs,
        non_production_services=non_prod_svcs,
        owners=owners,
        max_decay_factor=max_decay,
        cycle_detected=cycle_detected,
        paths=paths,
    )
