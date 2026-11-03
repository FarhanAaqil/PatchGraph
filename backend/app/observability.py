"""Structured JSON observability, latency percentiles, and stale-source monitors (Day 39)."""
from __future__ import annotations

import json
from typing import Any, Dict, List
import numpy as np

from backend.app.security.uploads import redact_secrets


class ObservabilityRegistry:
    def __init__(self) -> None:
        self.latencies_ms: Dict[str, List[float]] = {}
        self.error_counts: Dict[str, int] = {}
        self.structured_logs: List[Dict[str, Any]] = []

    def record_request(self, route: str, latency_ms: float, status_code: int, request_id: str, message: str = "ok") -> None:
        self.latencies_ms.setdefault(route, []).append(float(latency_ms))
        if status_code >= 400:
            self.error_counts[route] = self.error_counts.get(route, 0) + 1
        self.structured_logs.append(
            {
                "request_id": request_id,
                "route": route,
                "status_code": status_code,
                "latency_ms": round(latency_ms, 2),
                "message": redact_secrets(message),
            }
        )

    def summary(self) -> Dict[str, Any]:
        route_stats: Dict[str, Any] = {}
        for route, vals in self.latencies_ms.items():
            arr = np.array(vals, dtype=np.float64)
            route_stats[route] = {
                "count": len(vals),
                "p50_ms": round(float(np.percentile(arr, 50)), 2),
                "p95_ms": round(float(np.percentile(arr, 95)), 2),
                "errors": self.error_counts.get(route, 0),
            }
        return {"routes": route_stats, "log_entries": len(self.structured_logs)}
