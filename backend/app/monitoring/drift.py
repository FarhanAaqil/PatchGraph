"""Source freshness and feature distribution drift detector (Day 33)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
import numpy as np


def evaluate_source_freshness_and_drift(
    source_cutoffs: Dict[str, Dict[str, Any]],
    baseline_epss_samples: List[float],
    current_epss_samples: List[float],
    reference_time: datetime,
    max_age_hours: float = 48.0,
) -> Dict[str, Any]:
    stale_sources: List[str] = []
    for src, meta in source_cutoffs.items():
        fetched_dt = datetime.fromisoformat(meta["fetched_at"].replace("Z", "+00:00"))
        age_h = (reference_time - fetched_dt).total_seconds() / 3600.0
        if age_h > max_age_hours or meta.get("stale"):
            stale_sources.append(src)

    base_arr = np.array(baseline_epss_samples, dtype=np.float64)
    curr_arr = np.array(current_epss_samples, dtype=np.float64)
    mean_shift = float(abs(np.mean(curr_arr) - np.mean(base_arr)))
    drift_detected = mean_shift > 0.15

    return {
        "stale_sources": stale_sources,
        "any_stale": len(stale_sources) > 0,
        "epss_mean_shift": round(mean_shift, 4),
        "feature_drift_detected": drift_detected,
    }
