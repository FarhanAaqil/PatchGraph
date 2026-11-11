"""Bounded, cycle-safe dependency-and-deployment graph traversal (Day 16).

Enforces max depth <= 12, handles cycles safely via per-path visited sets,
computes hop decay, and assigns explicit reachability states.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from backend.app.graph.build import TypedSupplyChainGraph

MAX_ALLOWED_DEPTH = 12
DEFAULT_HOP_DECAY = 0.85


@dataclass(frozen=True)
class AffectedPathRecord:
    root_package_version_id: str
    service_name: str
    application_name: str
    environment: str
    production: bool
    owner_email: str
    hop_count: int
    decay_factor: float
    reachability_state: str
    path_nodes: List[str]
    cycle_detected: bool = False


def traverse_affected_paths(
    graph: TypedSupplyChainGraph,
    package_version_id: str,
    max_depth: int = 6,
    limit: int = 100,
    vex_overrides: Optional[Dict[Tuple[str, str], str]] = None,
) -> Tuple[List[AffectedPathRecord], bool]:
    """Bounded reverse BFS traversal from a vulnerable `package_version_id` up to services.

    Returns `(paths, cycle_encountered)`.
    """
    if not (1 <= max_depth <= MAX_ALLOWED_DEPTH):
        raise ValueError(f"max_depth {max_depth} must be in [1, {MAX_ALLOWED_DEPTH}]")
    if not (1 <= limit <= 500):
        raise ValueError(f"limit {limit} must be in [1, 500]")

    vex_map = vex_overrides or {}
    results: List[AffectedPathRecord] = []
    cycle_encountered = False

    # Queue holds (current_node_id, path_from_vulnerable_pkg)
    queue: deque[Tuple[str, List[str]]] = deque([(package_version_id, [package_version_id])])

    while queue and len(results) < limit:
        curr, path = queue.popleft()
        hop_depth = len(path) - 1
        if hop_depth >= max_depth:
            continue

        # Move upstream along reverse edges (who depends on or uses `curr`)
        for parent_id, _edge_meta in graph.rev_adj.get(curr, []):
            if parent_id in path:
                cycle_encountered = True
                continue

            new_path = path + [parent_id]
            parent_node = graph.nodes.get(parent_id, {})
            parent_kind = parent_node.get("kind")

            if parent_kind == "package_version":
                queue.append((parent_id, new_path))
            elif parent_kind == "service":
                svc_name = parent_node.get("label", parent_id.replace("service:", ""))
                owner_email = parent_node.get("owner_email") or "unassigned@patchgraph.local"

                # Resolve application and environment attached to this service
                app_name = "commerce-platform"
                for app_cand, _ in graph.rev_adj.get(parent_id, []):
                    if graph.nodes.get(app_cand, {}).get("kind") == "application":
                        app_name = graph.nodes[app_cand]["label"]
                        break

                env_name = "staging"
                is_prod = False
                for env_cand, e_meta in graph.adj.get(parent_id, []):
                    if e_meta.get("kind") == "deployed_in":
                        env_node = graph.nodes.get(env_cand, {})
                        env_name = env_node.get("label", "staging")
                        is_prod = bool(env_node.get("production", False))
                        break

                pkg_hops = len([n for n in new_path if graph.nodes.get(n, {}).get("kind") == "package_version"])
                decay = round(DEFAULT_HOP_DECAY ** max(0, pkg_hops - 1), 4)

                vex_status = vex_map.get((package_version_id, svc_name))
                if vex_status == "not_affected":
                    reach_state = "unreachable_vex"
                elif is_prod and pkg_hops == 1:
                    reach_state = "reachable_prod"
                elif is_prod:
                    reach_state = "reachable_prod"
                else:
                    reach_state = "reachable_non_prod"

                full_chain = new_path + [f"application:{app_name}", f"environment:{env_name}", f"owner:{owner_email}"]
                results.append(
                    AffectedPathRecord(
                        root_package_version_id=package_version_id,
                        service_name=svc_name,
                        application_name=app_name,
                        environment=env_name,
                        production=is_prod,
                        owner_email=owner_email,
                        hop_count=pkg_hops,
                        decay_factor=decay,
                        reachability_state=reach_state,
                        path_nodes=full_chain,
                        cycle_detected=cycle_encountered,
                    )
                )

    # Deduplicate by (service_name, environment) keeping shortest hop path
    dedup: Dict[Tuple[str, str], AffectedPathRecord] = {}
    for rec in results:
        key = (rec.service_name, rec.environment)
        if key not in dedup or rec.hop_count < dedup[key].hop_count:
            dedup[key] = rec

    return list(dedup.values()), cycle_encountered
