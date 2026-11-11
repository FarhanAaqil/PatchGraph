"""Idempotent scheduled evidence refresh job with exponential backoff and fallback (Day 34)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass
class RefreshJobRun:
    job_key: str
    status: str  # 'succeeded', 'fallback_pinned_snapshot', 'failed'
    attempts: int
    used_cached_snapshot: bool
    active_snapshot_id: str
    backoff_schedule_seconds: List[float]


class ScheduledRefreshManager:
    def __init__(self) -> None:
        self._completed_keys: Dict[str, RefreshJobRun] = {}

    def run_idempotent_refresh(
        self,
        job_key: str,
        pinned_snapshot_id: str = "snap_01",
        simulate_http_status: int = 200,
        max_retries: int = 3,
    ) -> RefreshJobRun:
        if job_key in self._completed_keys:
            return self._completed_keys[job_key]

        backoff_schedule: List[float] = []
        for attempt in range(1, max_retries + 1):
            if simulate_http_status == 200:
                run = RefreshJobRun(
                    job_key=job_key,
                    status="succeeded",
                    attempts=attempt,
                    used_cached_snapshot=False,
                    active_snapshot_id=pinned_snapshot_id,
                    backoff_schedule_seconds=backoff_schedule,
                )
                self._completed_keys[job_key] = run
                return run
            # 429 or 5xx triggers exponential backoff
            backoff_schedule.append(round(0.5 * (2 ** (attempt - 1)), 2))

        # Fallback per Risk Register: pinned snapshot with visible staleness
        run = RefreshJobRun(
            job_key=job_key,
            status="fallback_pinned_snapshot",
            attempts=max_retries,
            used_cached_snapshot=True,
            active_snapshot_id=pinned_snapshot_id,
            backoff_schedule_seconds=backoff_schedule,
        )
        self._completed_keys[job_key] = run
        return run
