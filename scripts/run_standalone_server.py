"""Production Multi-Page & API Server Launcher (`scripts/run_standalone_server.py`).

Serves:
- All 12 `/api/v1/*` JSON contract endpoints
- All 14 multi-page HTML routes at `/pages/<page_id>` (`dashboard`, `assets`, `dependency-graph`, etc.)
- Root redirect/entrypoint at `/`
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException
from fastapi.responses import HTMLResponse
from backend.app.main import app

PAGES_DIR = REPO_ROOT / "frontend" / "pages"
PREVIEW_HTML_PATH = REPO_ROOT / "frontend" / "standalone_preview.html"


@app.get("/", response_class=HTMLResponse)
async def serve_root_app() -> HTMLResponse:
    if PREVIEW_HTML_PATH.exists():
        return HTMLResponse(PREVIEW_HTML_PATH.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>PatchGraph v1.0 Running</h1>")


@app.get("/pages/{page_id}", response_class=HTMLResponse)
async def serve_multipage_route(page_id: str) -> HTMLResponse:
    target = PAGES_DIR / f"{page_id}.html"
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Page '/pages/{page_id}' not found")
    return HTMLResponse(target.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
