"""Standalone launcher: the JSON backend and the built web interface on one port (`scripts/run_standalone_server.py`).

Serves:
- every `/api/v1/*` route and the top-level `/health` check
- the compiled single-page application from `frontend/dist`

Caching policy for the static side:
- `/assets/*` files carry a content hash in their name, so they are cacheable for a year (`immutable`)
- `index.html` and other root files are revalidated on every load so a new build is picked up immediately
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
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.app.main import app

DIST_DIR = REPO_ROOT / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"
IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "no-cache"


class ImmutableStaticFiles(StaticFiles):
    """Static files whose names are content-hashed, so browsers and CDNs may keep them indefinitely."""

    def file_response(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = IMMUTABLE
        return response


if ASSETS_DIR.exists():
    app.mount("/assets", ImmutableStaticFiles(directory=str(ASSETS_DIR)), name="assets")

_index_cache: dict[str, object] = {"mtime": 0.0, "html": ""}


def _index_html() -> str | None:
    """index.html is tiny and read on every navigation, so keep it in memory until the file changes."""
    path = DIST_DIR / "index.html"
    if not path.exists():
        return None
    mtime = path.stat().st_mtime
    if _index_cache["mtime"] != mtime:
        _index_cache["html"] = path.read_text(encoding="utf-8")
        _index_cache["mtime"] = mtime
    return str(_index_cache["html"])


def _page(html: str) -> HTMLResponse:
    return HTMLResponse(html, headers={"Cache-Control": REVALIDATE})


@app.get("/", response_class=HTMLResponse)
async def serve_root_app() -> HTMLResponse:
    html = _index_html()
    if html is not None:
        return _page(html)
    return HTMLResponse(
        "<h1>PatchGraph is running</h1><p>The web interface has not been built yet: run <code>cd frontend &amp;&amp; npm run build</code>.</p>"
    )


# Client-side routes fall back to index.html; real files in dist (favicon, manifest) are served as they are.
@app.get("/{full_path:path}")
async def serve_spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("assets/") or full_path == "health":
        raise HTTPException(status_code=404, detail="Not Found")
    candidate = (DIST_DIR / full_path).resolve()
    if full_path and candidate.is_file() and DIST_DIR.resolve() in candidate.parents:
        return FileResponse(candidate, headers={"Cache-Control": REVALIDATE})
    html = _index_html()
    if html is not None:
        return _page(html)
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
