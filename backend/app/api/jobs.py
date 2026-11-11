"""Job status and event stream."""

from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, Depends

from backend.app.api.common import (
    ContractError,
    get_request_context,
)
from backend.app.jobs.shell import JOB_QUEUE

router = APIRouter()


def _job_or_404(ctx: Dict[str, str], job_id: str):
    job = JOB_QUEUE.get(ctx["project_id"], job_id)
    if job is None:
        raise ContractError(status_code=404, code="JOB_NOT_FOUND", message=f"No job '{job_id}' in this project.")
    return job


def _job_view(job, request_id: str) -> Dict[str, Any]:
    return {
        "id": job.job_id,
        "type": job.job_type,
        "status": job.status,
        "progress": 100 if job.status == "completed" else 0,
        "stage": job.job_type,
        "errors": [job.error] if job.error else [],
        "created_at": job.created_at,
        "finished_at": job.finished_at,
        "request_id": request_id,
    }


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
) -> Dict[str, Any]:
    return _job_view(_job_or_404(ctx, job_id), ctx["request_id"])


@router.get("/jobs/{job_id}/events")
async def stream_job_events(
    job_id: str,
    ctx: Dict[str, str] = Depends(get_request_context),
):
    from fastapi.responses import StreamingResponse

    job = _job_view(_job_or_404(ctx, job_id), ctx["request_id"])

    async def event_generator():
        yield f"data: {json.dumps({'job_id': job['id'], 'progress': job['progress'], 'status': job['status']})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
