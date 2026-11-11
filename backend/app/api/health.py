"""Data freshness, upstream source status and service health."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends

from backend.app.api.common import (
    get_request_context,
)
from backend.app.db.session import DatabaseManager, get_db

router = APIRouter()


@router.get("/health/data")
async def get_data_health(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    snap = db.conn.execute(
        "SELECT id, manifest_sha256, source_cutoffs FROM evidence_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (ctx["project_id"],),
    ).fetchone()

    cutoffs = json.loads(snap["source_cutoffs"]) if snap else {}

    sources = []

    any_stale = False

    for src_name, meta in cutoffs.items():
        is_stale = bool(meta.get("stale", False))

        any_stale = any_stale or is_stale

        sources.append(
            {
                "source": src_name,
                "source_url": meta["source_url"],
                "last_fetched_at": meta["fetched_at"],
                "content_sha256": meta["content_sha256"],
                "parser_version": meta.get("parser_version", "1.0.0"),
                "stale": is_stale,
                "status": "stale" if is_stale else "healthy",
                "error_count": 0,
            }
        )

    return {
        "overall_status": "stale" if any_stale else "healthy",
        "offline_demo_mode": True,
        "active_snapshot": snap["id"] if snap else "snap_01",
        "manifest_sha256": snap["manifest_sha256"] if snap else "",
        "sources": sources,
        "recent_import_errors": [],
        "request_id": ctx["request_id"],
    }


@router.get("/sources/status")
async def get_sources_status(
    ctx: Dict[str, str] = Depends(get_request_context),
    db: DatabaseManager = Depends(get_db),
) -> Dict[str, Any]:

    snap = db.conn.execute(
        "SELECT id, source_cutoffs, manifest_sha256 FROM evidence_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (ctx["project_id"],),
    ).fetchone()
    cutoffs = json.loads(snap["source_cutoffs"]) if snap else {}

    sources = {
        name: {
            "status": "stale" if meta.get("stale") else "synced",
            "last_sync": meta.get("fetched_at"),
            "stale": bool(meta.get("stale")),
            "parser_version": meta.get("parser_version", "1.0.0"),
            "content_sha256": meta.get("content_sha256"),
            "source_url": meta.get("source_url"),
        }
        for name, meta in cutoffs.items()
    }
    if not snap:
        freshness = "unavailable"
    elif any(src["stale"] for src in sources.values()):
        freshness = "stale"
    else:
        freshness = "synchronized"

    return {
        "sources": sources,
        "snapshot_sha256": snap["manifest_sha256"] if snap else None,
        "data_freshness": freshness,
        "snapshot_id": snap["id"] if snap else None,
        "offline_demo_mode": os.environ.get("PATCHGRAPH_OFFLINE_DEMO", "true").strip().lower()
        not in ("0", "false", "no"),
        "request_id": ctx["request_id"],
    }


@router.get("/health")
async def get_system_health() -> Dict[str, Any]:

    return {
        "status": "ok",
        "service": "PatchGraph",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
