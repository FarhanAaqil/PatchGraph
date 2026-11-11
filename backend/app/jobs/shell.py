"""In-process job tracking for PatchGraph.

Workers only ever receive narrow payloads (IDs and snapshot references, never credentials or unbounded
blobs). This is a single-process queue: `enqueue` runs the supplied work synchronously and records how it
ended, so a job's status always reflects what actually happened. Swap it for a broker-backed queue when
work needs to leave the API process.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

QUEUED = "queued"
COMPLETED = "completed"
FAILED = "failed"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class JobRecord:
    job_id: str
    job_type: str
    project_id: str
    entity_id: str
    status: str
    created_at: str
    finished_at: Optional[str] = None
    error: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)


class JobQueueShell:
    ALLOWED_PAYLOAD_KEYS = {"import_id", "snapshot_id", "risk_run_id", "planning_run_id", "kind"}

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = threading.Lock()

    def _validated(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        disallowed = set(payload.keys()) - self.ALLOWED_PAYLOAD_KEYS
        if disallowed:
            raise ValueError(f"Job payload contains non-narrow keys: {sorted(disallowed)}")
        return dict(payload)

    def _store(self, record: JobRecord) -> JobRecord:
        with self._lock:
            self._jobs[record.job_id] = record
        return record

    def enqueue(
        self,
        job_type: str,
        project_id: str,
        entity_id: str,
        payload: Dict[str, Any],
        work: Optional[Callable[[], None]] = None,
    ) -> JobRecord:
        """Register a job and, if `work` is given, run it now. Without `work` the job stays `queued`."""
        record = self._store(
            JobRecord(
                job_id=f"job_{uuid.uuid4().hex[:10]}",
                job_type=job_type,
                project_id=project_id,
                entity_id=entity_id,
                status=QUEUED,
                created_at=_now(),
                payload=self._validated(payload),
            )
        )
        if work is None:
            return record
        try:
            work()
        except Exception as exc:
            return self._store(replace(record, status=FAILED, finished_at=_now(), error=str(exc)))
        return self._store(replace(record, status=COMPLETED, finished_at=_now()))

    def record_completed(
        self, job_type: str, project_id: str, entity_id: str, payload: Dict[str, Any], job_id: Optional[str] = None
    ) -> JobRecord:
        """Log work the caller already finished synchronously, e.g. an import handled inside the request."""
        now = _now()
        return self._store(
            JobRecord(
                job_id=job_id or f"job_{uuid.uuid4().hex[:10]}",
                job_type=job_type,
                project_id=project_id,
                entity_id=entity_id,
                status=COMPLETED,
                created_at=now,
                finished_at=now,
                payload=self._validated(payload),
            )
        )

    def get(self, project_id: str, job_id: str) -> Optional[JobRecord]:
        record = self._jobs.get(job_id)
        return record if record is not None and record.project_id == project_id else None

    def list_jobs(self, project_id: str) -> List[Dict[str, Any]]:
        return [asdict(j) for j in self._jobs.values() if j.project_id == project_id]


JOB_QUEUE = JobQueueShell()
