"""2-Layer Graph Neural Network (Message-Passing) Stretch Ablation (`intelligence/risk/gnn_ablation.py`).

Implements the stretch ablation described in `09_ML_Research_PatchGraph.md`:
Compares a 2-layer normalized adjacency message-passing GNN (`H^{(l+1)} = ReLU(D^{-1/2} A D^{-1/2} H^{(l)} W^{(l)})`)
against the deterministic typed traversal engine on the same frozen graph snapshot.
Note: Deterministic traversal remains the authoritative production method.
"""
from __future__ import annotations

from typing import Any, Dict, List
import numpy as np

from backend.app.graph.build import TypedSupplyChainGraph


def run_gnn_message_passing_ablation(
    graph: TypedSupplyChainGraph,
    seed: int = 42,
) -> Dict[str, Any]:
    node_ids = sorted(graph.nodes.keys())
    idx_map = {nid: i for i, nid in enumerate(node_ids)}
    n = len(node_ids)

    # Adjacency with self-loops
    A = np.eye(n, dtype=np.float64)
    for src, targets in graph.adj.items():
        if src not in idx_map:
            continue
        i = idx_map[src]
        for dst, _ in targets:
            if dst in idx_map:
                j = idx_map[dst]
                A[i, j] = 1.0
                A[j, i] = 1.0

    deg = np.sum(A, axis=1)
    d_inv_sqrt = np.diag(1.0 / np.sqrt(np.maximum(1.0, deg)))
    A_hat = d_inv_sqrt @ A @ d_inv_sqrt

    # Initial node features [is_pkg, is_service, criticality_norm, is_prod]
    X = np.zeros((n, 4), dtype=np.float64)
    for i, nid in enumerate(node_ids):
        meta = graph.nodes[nid]
        kind = meta.get("kind", "")
        X[i, 0] = 1.0 if kind == "package_version" else 0.0
        X[i, 1] = 1.0 if kind == "service" else 0.0
        X[i, 2] = float(meta.get("criticality", 3)) / 5.0
        X[i, 3] = 1.0 if meta.get("production", False) else 0.0

    rng = np.random.default_rng(seed)
    W1 = rng.normal(0.25, 0.08, size=(4, 8))
    W2 = rng.normal(0.25, 0.08, size=(8, 1))

    H1 = np.maximum(0.0, A_hat @ X @ W1)
    logits = (A_hat @ H1 @ W2).squeeze(-1)
    scores = 1.0 / (1.0 + np.exp(-logits))

    node_scores = {node_ids[i]: round(float(scores[i]), 4) for i in range(n)}
    return {
        "method": "2-Layer GCN Message-Passing (Stretch Ablation Only)",
        "production_authoritative": False,
        "node_count": n,
        "node_embeddings_scored": node_scores,
    }
