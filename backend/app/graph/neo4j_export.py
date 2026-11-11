"""Optional Neo4j Cypher Exporter (`backend/app/graph/neo4j_export.py`).

Exports the authoritative PostgreSQL/NetworkX typed supply-chain graph to
idempotent Neo4j Cypher `MERGE` statements for external graph visualization tools.
"""

from __future__ import annotations

from typing import List

from backend.app.graph.build import TypedSupplyChainGraph


def export_graph_to_cypher(graph: TypedSupplyChainGraph) -> str:
    lines: List[str] = ["// PatchGraph Exported Cypher Topology"]
    for nid, meta in sorted(graph.nodes.items()):
        kind_label = meta.get("kind", "Node").title().replace("_", "")
        label = meta.get("label", nid).replace('"', '\\"')
        lines.append(f'MERGE (n:{kind_label} {{id: "{nid}", label: "{label}"}});')

    for src, edges in sorted(graph.adj.items()):
        for dst, emeta in edges:
            rel_type = emeta.get("kind", "DEPENDS_ON").upper()
            lines.append(f'MATCH (a {{id: "{src}"}}), (b {{id: "{dst}"}}) MERGE (a)-[:{rel_type}]->(b);')
    return "\n".join(lines) + "\n"
