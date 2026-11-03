"""Evaluation Harness Manifest & Bootstrap Confidence Interval Utilities (Day 43)."""
from __future__ import annotations

import hashlib
import json
from typing import Any, Callable, Dict, List, Tuple
import numpy as np


def bootstrap_ci(
    values: np.ndarray,
    stat_fn: Callable[[np.ndarray], float] = np.mean,
    n_boot: int = 200,
    seed: int = 42,
) -> Tuple[float, float, float]:
    """Return `(point_estimate, ci_low_95, ci_high_95)` via deterministic bootstrap resampling."""
    rng = np.random.default_rng(seed)
    point = float(stat_fn(values))
    if len(values) <= 1:
        return round(point, 4), round(point, 4), round(point, 4)
    samples = []
    n = len(values)
    for _ in range(n_boot):
        idx = rng.integers(0, n, size=n)
        samples.append(float(stat_fn(values[idx])))
    lo, hi = np.percentile(samples, [2.5, 97.5])
    return round(point, 4), round(float(lo), 4), round(float(hi), 4)


def compute_ndcg_at_k(relevances: List[float], k: int = 5) -> float:
    rel = np.array(relevances[:k], dtype=np.float64)
    if len(rel) == 0:
        return 0.0
    discounts = np.log2(np.arange(2, len(rel) + 2))
    dcg = float(np.sum(rel / discounts))
    ideal_rel = np.sort(np.array(relevances, dtype=np.float64))[::-1][:k]
    idcg = float(np.sum(ideal_rel / np.log2(np.arange(2, len(ideal_rel) + 2))))
    return round(dcg / idcg, 4) if idcg > 0 else 0.0


def build_evaluation_manifest_meta(seed: int = 42) -> Dict[str, Any]:
    return {
        "snapshot_id": "snap_01",
        "manifest_sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        "dataset_date": "2026-11-01",
        "seed": seed,
        "code_revision": "v1.0.0-rc1",
        "model_version": "calibrated-logreg-v1",
        "solver": "OR-Tools CP-SAT (single-worker deterministic)",
    }
