"""Response-time and bandwidth helpers: server-side GET cache, ETag revalidation and Server-Timing.

How the pieces fit together (outermost first):

    GZip  ->  ResponseCache (cache + ETag/304)  ->  request-id / security headers  ->  routes

* **Server-side cache.** Successful JSON GETs under /api/v1 are kept in memory per caller identity. Any write
  (POST/PUT/PATCH/DELETE) bumps a data version, which instantly invalidates everything, so a reader can never
  see data older than the last write. A short TTL is a second safety net for changes made outside the API.
* **ETag / 304.** Every cached or fresh JSON GET gets a strong validator. Browsers revalidate with
  `If-None-Match` and receive an empty 304 when nothing changed, which keeps payloads and parse time off the
  critical path. `Cache-Control: no-cache` forces that revalidation, so the UI never shows stale data.
* **Server-Timing.** Each response reports how long the app took, visible in browser dev tools and Lighthouse.
"""

from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

CACHE_TTL_SECONDS = 15.0
MAX_ENTRIES = 256
MAX_BODY_BYTES = 1_000_000
CACHE_PREFIX = "/api/v1/"
UNCACHED_SUFFIXES = ("/events",)
IDENTITY_HEADERS = ("authorization", "x-project-id", "x-user-id", "x-user-role", "origin")
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@dataclass
class _Entry:
    stored_at: float
    version: int
    status: int
    media_type: str
    headers: Dict[str, str]
    body: bytes
    etag: str


class ResponseCache:
    """One cache per app instance, so separate apps (or test databases) never see each other's responses."""

    def __init__(self) -> None:
        self._entries: "OrderedDict[Tuple[str, ...], _Entry]" = OrderedDict()
        self._lock = threading.Lock()
        self.version = 0
        self.hits = 0
        self.misses = 0

    def get(self, key: Tuple[str, ...]) -> Optional[_Entry]:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.version != self.version or time.monotonic() - entry.stored_at > CACHE_TTL_SECONDS:
                self._entries.pop(key, None)
                return None
            self._entries.move_to_end(key)
            return entry

    def put(self, key: Tuple[str, ...], entry: _Entry) -> None:
        with self._lock:
            self._entries[key] = entry
            self._entries.move_to_end(key)
            while len(self._entries) > MAX_ENTRIES:
                self._entries.popitem(last=False)

    def invalidate(self) -> None:
        with self._lock:
            self.version += 1
            self._entries.clear()


def _cache_key(request: Request) -> Tuple[str, ...]:
    identity = tuple(request.headers.get(h, "") for h in IDENTITY_HEADERS)
    return (request.url.path, request.url.query, *identity)


def _etag(body: bytes) -> str:
    return '"' + hashlib.sha1(body, usedforsecurity=False).hexdigest()[:20] + '"'


def _not_modified(etag: str) -> Response:
    return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "no-cache"})


class ResponseCacheMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, cache: ResponseCache) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.cache = cache

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started = time.perf_counter()
        path = request.url.path

        if request.method in WRITE_METHODS:
            response = await call_next(request)
            self.cache.invalidate()  # even a failed write may have changed state part-way
            return _timed(response, started)

        cacheable = request.method == "GET" and path.startswith(CACHE_PREFIX) and not path.endswith(UNCACHED_SUFFIXES)
        if not cacheable:
            return _timed(await call_next(request), started)

        key = _cache_key(request)
        entry = self.cache.get(key)
        if entry is not None:
            self.cache.hits += 1
            if request.headers.get("if-none-match") == entry.etag:
                return _timed(_not_modified(entry.etag), started, cache="HIT")
            return _timed(_from_entry(entry), started, cache="HIT")

        self.cache.misses += 1
        version_before = self.cache.version
        response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if response.status_code != 200 or "application/json" not in content_type:
            return _timed(response, started, cache="BYPASS")

        body = b"".join([chunk async for chunk in response.body_iterator])  # type: ignore[attr-defined]
        etag = _etag(body)
        headers = {k: v for k, v in response.headers.items() if k.lower() not in ("content-length", "x-request-id")}
        entry = _Entry(time.monotonic(), version_before, 200, content_type, headers, body, etag)
        if len(body) <= MAX_BODY_BYTES and version_before == self.cache.version:
            self.cache.put(key, entry)

        if request.headers.get("if-none-match") == etag:
            return _timed(_not_modified(etag), started, cache="MISS")
        out = _from_entry(entry)
        out.headers["X-Request-Id"] = response.headers.get("x-request-id", "")
        return _timed(out, started, cache="MISS")


def _from_entry(entry: _Entry) -> Response:
    response = Response(content=entry.body, status_code=entry.status, media_type=entry.media_type)
    for name, value in entry.headers.items():
        if name.lower() not in ("content-type",):
            response.headers[name] = value
    response.headers["ETag"] = entry.etag
    response.headers["Cache-Control"] = "no-cache"
    return response


def _timed(response: Response, started: float, cache: Optional[str] = None) -> Response:
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    timing = f"app;dur={elapsed_ms:.1f}"
    if cache:
        timing += f", cache;desc={cache}"
        response.headers["X-Cache"] = cache
    response.headers["Server-Timing"] = timing
    return response
