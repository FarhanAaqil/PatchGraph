"""Typed dependency-and-deployment graph builder and persistence (Day 13).

Provides an in-process NetworkX-compatible typed directed graph projection over
PostgreSQL/SQLite tables (`packages`, `package_versions`, `dependencies`,
`service_components`, `services`, `applications`, `assets`, `environments`).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set, Tuple

from backend.app.db.session import DatabaseManager
from backend.app.ingest.sbom import ValidatedSbomDocument


@dataclass
class TypedSupplyChainGraph:
    """In-process typed directed graph with NetworkX-compatible node/edge inspection."""

    nodes: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    adj: Dict[str, List[Tuple[str, Dict[str, Any]]]] = field(default_factory=lambda: defaultdict(list))
    rev_adj: Dict[str, List[Tuple[str, Dict[str, Any]]]] = field(default_factory=lambda: defaultdict(list))

    def add_node(self, node_id: str, kind: str, label: str, **attrs: Any) -> None:
        self.nodes[node_id] = {"id": node_id, "kind": kind, "label": label, **attrs}

    def add_edge(self, source: str, target: str, kind: str, **attrs: Any) -> None:
        edge_meta = {"source": source, "target": target, "kind": kind, **attrs}
        if (target, edge_meta) not in self.adj[source]:
            self.adj[source].append((target, edge_meta))
            self.rev_adj[target].append((source, edge_meta))

    def number_of_nodes(self) -> int:
        return len(self.nodes)

    def number_of_edges(self) -> int:
        return sum(len(v) for v in self.adj.values())


def persist_validated_sbom_graph(
    db: DatabaseManager,
    project_id: str,
    import_id: str,
    validated: ValidatedSbomDocument,
) -> Dict[str, int]:
    """Persist normalized packages, package_versions, and deduplicated dependency edges."""
    cur = db.conn.cursor()
    ref_to_pv_id: Dict[str, str] = {}
    packages_upserted = 0
    versions_upserted = 0
    edges_inserted = 0

    for ref_key, coord in validated.components.items():
        pkg_row = cur.execute(
            "SELECT id FROM packages WHERE ecosystem = ? AND normalized_name = ?",
            (coord.ecosystem, coord.normalized_name),
        ).fetchone()
        if pkg_row:
            pkg_id = pkg_row["id"]
        else:
            pkg_id = f"pkg_{coord.ecosystem}_{coord.normalized_name.replace('/', '_')}"
            cur.execute(
                "INSERT INTO packages (id, ecosystem, normalized_name, purl) VALUES (?, ?, ?, ?)",
                (pkg_id, coord.ecosystem, coord.normalized_name, f"pkg:{coord.ecosystem}/{coord.normalized_name}"),
            )
            packages_upserted += 1

        pv_row = cur.execute(
            "SELECT id FROM package_versions WHERE package_id = ? AND version = ?",
            (pkg_id, coord.version),
        ).fetchone()
        if pv_row:
            pv_id = pv_row["id"]
        else:
            pv_id = f"pv_{coord.normalized_name.replace('-', '_')}_{coord.normalized_version.replace('.', '_')}"
            cur.execute(
                "INSERT INTO package_versions (id, package_id, version, normalized_version) VALUES (?, ?, ?, ?)",
                (pv_id, pkg_id, coord.version, coord.normalized_version),
            )
            versions_upserted += 1

        ref_to_pv_id[ref_key] = pv_id

    for edge in validated.edges:
        parent_pv = ref_to_pv_id.get(edge.parent_ref)
        child_pv = ref_to_pv_id.get(edge.child_ref)
        if not parent_pv or not child_pv:
            continue
        existing_edge = cur.execute(
            """SELECT id FROM dependencies
               WHERE import_id = ? AND parent_version_id = ? AND child_version_id = ? AND scope = ?""",
            (import_id, parent_pv, child_pv, edge.scope),
        ).fetchone()
        if existing_edge is None:
            cur.execute(
                """INSERT INTO dependencies (project_id, parent_version_id, child_version_id, scope, optional, import_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (project_id, parent_pv, child_pv, edge.scope, int(edge.optional), import_id),
            )
            edges_inserted += 1

    db.conn.commit()
    return {
        "packages_upserted": packages_upserted,
        "versions_upserted": versions_upserted,
        "edges_inserted": edges_inserted,
        "collapsed_duplicate_edges": validated.collapsed_duplicate_edges,
    }


def build_project_supply_chain_graph(db: DatabaseManager, project_id: str) -> TypedSupplyChainGraph:
    """Project PostgreSQL/SQLite tables into a typed dependency-and-deployment graph."""
    g = TypedSupplyChainGraph()
    cur = db.conn.cursor()

    # Package versions
    pv_rows = cur.execute(
        """SELECT pv.id, pv.version, pv.normalized_version, p.ecosystem, p.normalized_name, p.purl
           FROM package_versions pv
           JOIN packages p ON pv.package_id = p.id"""
    ).fetchall()
    for r in pv_rows:
        g.add_node(
            r["id"],
            kind="package_version",
            label=f"{r['normalized_name']}@{r['version']}",
            ecosystem=r["ecosystem"],
            package_name=r["normalized_name"],
            version=r["version"],
        )

    # Dependency edges (parent_version -> child_version)
    dep_rows = cur.execute(
        "SELECT parent_version_id, child_version_id, scope, optional FROM dependencies WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    for d in dep_rows:
        g.add_edge(
            d["parent_version_id"],
            d["child_version_id"],
            kind="depends_on",
            scope=d["scope"] or "runtime",
            optional=bool(d["optional"]),
        )

    # Applications, services, environments, assets, owners
    svc_rows = cur.execute(
        """SELECT s.id AS service_id, s.name AS service_name, s.owner_email,
                  a.id AS app_id, a.name AS app_name, a.criticality AS app_criticality
           FROM services s
           JOIN applications a ON s.application_id = a.id
           WHERE a.project_id = ?""",
        (project_id,),
    ).fetchall()
    for s in svc_rows:
        svc_node = f"service:{s['service_name']}"
        app_node = f"application:{s['app_name']}"
        owner_node = f"owner:{s['owner_email'] or 'unassigned@patchgraph.local'}"
        g.add_node(svc_node, kind="service", label=s["service_name"], db_id=s["service_id"], owner_email=s["owner_email"])
        g.add_node(app_node, kind="application", label=s["app_name"], criticality=s["app_criticality"])
        g.add_node(owner_node, kind="owner", label=s["owner_email"] or "unassigned@patchgraph.local")
        g.add_edge(app_node, svc_node, kind="owns_service")
        g.add_edge(svc_node, owner_node, kind="owned_by")

    sc_rows = cur.execute(
        """SELECT s.name AS service_name, e.name AS env_name, e.production, e.max_downtime_minutes,
                  sc.package_version_id, sc.direct
           FROM service_components sc
           JOIN services s ON sc.service_id = s.id
           JOIN applications a ON s.application_id = a.id
           JOIN environments e ON sc.environment_id = e.id
           WHERE a.project_id = ?""",
        (project_id,),
    ).fetchall()
    for sc in sc_rows:
        svc_node = f"service:{sc['service_name']}"
        env_node = f"environment:{sc['env_name']}"
        g.add_node(
            env_node,
            kind="environment",
            label=sc["env_name"],
            production=bool(sc["production"]),
            max_downtime_minutes=sc["max_downtime_minutes"],
        )
        g.add_edge(svc_node, sc["package_version_id"], kind="uses_component", direct=bool(sc["direct"]))
        g.add_edge(svc_node, env_node, kind="deployed_in")

    return g
