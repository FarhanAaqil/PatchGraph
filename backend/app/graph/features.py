"""Bounded graph centrality and structural impact features (Day 31)."""

from __future__ import annotations

from typing import Dict

from backend.app.graph.build import TypedSupplyChainGraph
from backend.app.graph.traverse import traverse_affected_paths


def compute_package_centrality_features(
    graph: TypedSupplyChainGraph,
    package_version_id: str,
    max_depth: int = 6,
) -> Dict[str, float]:
    """Compute reverse dependent fan-in, service reach ratio, and centrality contribution."""
    direct_dependents = len(graph.rev_adj.get(package_version_id, []))
    paths, _ = traverse_affected_paths(graph, package_version_id=package_version_id, max_depth=max_depth)

    total_services = max(
        1,
        len([nid for nid, meta in graph.nodes.items() if meta.get("kind") == "service"]),
    )
    reached_services = len({p.service_name for p in paths if p.reachability_state != "unreachable_vex"})
    prod_reached = len({p.service_name for p in paths if p.production and p.reachability_state != "unreachable_vex"})

    service_reach_ratio = round(reached_services / float(total_services), 4)
    centrality_score = round(min(1.0, 0.35 * direct_dependents + 0.45 * service_reach_ratio + 0.20 * prod_reached), 4)
    return {
        "direct_dependents": float(direct_dependents),
        "reached_services": float(reached_services),
        "prod_reached_services": float(prod_reached),
        "service_reach_ratio": service_reach_ratio,
        "centrality_score": centrality_score,
    }
