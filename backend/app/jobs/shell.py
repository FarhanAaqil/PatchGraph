"""Narrow-payload background job shell for PatchGraph.

Per 04_Architecture_PatchGraph.md, background workers receive narrow job payloads
(only IDs and snapshot references, never raw credentials or unbounded blobs).
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List


@dataclass(frozen=True)
class JobRecord:
    job_id: str
    job_type: str
    project_id: str
    entity_id: str
    status: str
    created_at: str
    payload: Dict[str, Any] = field(default_factory=dict)


class JobQueueShell:
    """In-process deterministic job queue shell for Phase 1 Architecture Skeleton."""

    ALLOWED_PAYLOAD_KEYS = {"import_id", "snapshot_id", "risk_run_id", "planning_run_id", "kind"}

    def __init__(self) -> None:
        self._jobs: List[JobRecord] = []

    def enqueue(self, job_type: str, project_id: str, entity_id: str, payload: Dict[str, Any]) -> JobRecord:
        disallowed = set(payload.keys()) - self.ALLOWED_PAYLOAD_KEYS
        if disallowed:
            raise ValueError(f"Job payload contains non-narrow keys: {sorted(disallowed)}")
        record = JobRecord(
            job_id=f"job_{uuid.uuid4().hex[:10]}",
            job_type=job_type,
            project_id=project_id,
            entity_id=entity_id,
            status="completed",
            created_at=datetime.now(timezone.utc).isoformat(),
            payload=dict(payload),
        )
        self._jobs.append(record)
        return record

    def list_jobs(self, project_id: str) -> List[Dict[str, Any]]:
        return [asdict(j) for j in self._jobs if j.project_id == project_id]


JOB_QUEUE = JobQueueShell()
