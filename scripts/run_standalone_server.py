"""Production Multi-Page & API Server Launcher (`scripts/run_standalone_server.py`).

Serves:
- All `/api/v1/*` JSON contract endpoints
- Top-level `/health` endpoint
- Full React + Vite + Three.js single-page application from `frontend/dist`
- Legacy HTML routes at `/pages/{page_id}`
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from backend.app.main import app

DIST_DIR = REPO_ROOT / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"
PAGES_DIR = REPO_ROOT / "frontend" / "pages"
PREVIEW_HTML_PATH = REPO_ROOT / "frontend" / "standalone_preview.html"

# Mount static Vite assets if built
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/", response_class=HTMLResponse)
async def serve_root_app() -> HTMLResponse:
    dist_index = DIST_DIR / "index.html"
    if dist_index.exists():
        return HTMLResponse(dist_index.read_text(encoding="utf-8"))
    if PREVIEW_HTML_PATH.exists():
        return HTMLResponse(PREVIEW_HTML_PATH.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>PatchGraph v1.0 Running</h1>")


@app.get("/pages/{page_id}", response_class=HTMLResponse)
async def serve_multipage_route(page_id: str) -> HTMLResponse:
    target = PAGES_DIR / f"{page_id}.html"
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Page '/pages/{page_id}' not found")
    return HTMLResponse(target.read_text(encoding="utf-8"))


# Fallback SPA routing for client-side pages
@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_spa_fallback(full_path: str) -> HTMLResponse:
    if full_path.startswith("api/") or full_path.startswith("assets/") or full_path == "health":
        raise HTTPException(status_code=404, detail="Not Found")
    dist_index = DIST_DIR / "index.html"
    if dist_index.exists():
        return HTMLResponse(dist_index.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="Page not found")


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="PatchGraph Standalone Server")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "5000")),
        help="Port to run the standalone server on (default: 5000)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=os.environ.get("HOST", "127.0.0.1"),
        help="Host interface to bind to (default: 127.0.0.1)",
    )
    args = parser.parse_args()

    print(f"Starting PatchGraph Standalone Server on http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)
