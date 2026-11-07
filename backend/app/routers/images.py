"""Same-origin image proxy for WebGL textures.

Wikimedia's Special:FilePath redirect and archive.org's thumbnail service do not send cross-origin headers, so a
browser cannot upload those pictures into a WebGL texture directly. This endpoint fetches a picture server-side
from an allow-listed host, caches it on disk, and serves it from the museum's own origin.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..config import get_settings

router = APIRouter(prefix="/api", tags=["media"])
ALLOWED_HOSTS = {"commons.wikimedia.org", "upload.wikimedia.org", "thumb.wikimedia.org", "archive.org", "ia800000.us.archive.org"}
UA = "IHH-virtual-museum/1.0 (Challenge X prototype for the Immigrant Hall of Honor; https://immigranthallofhonor.org)"
MAX_BYTES = 8 * 1024 * 1024


def _cache_dir() -> Path:
    d = get_settings().data_dir / "cache" / "images"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.get("/image", summary="Proxy a licensed picture from Wikimedia Commons or the Internet Archive for use as a texture")
def proxy_image(url: str = Query(min_length=10, max_length=1000)):
    host = urlparse(url).hostname or ""
    if urlparse(url).scheme != "https" or not (host in ALLOWED_HOSTS or host.endswith(".archive.org") or host.endswith(".wikimedia.org")):
        raise HTTPException(status_code=400, detail="Host not allowed")
    key = hashlib.sha256(url.encode()).hexdigest()[:32]
    cached = next(_cache_dir().glob(f"{key}.*"), None)
    if cached is None:
        try:
            with httpx.Client(headers={"User-Agent": UA}, timeout=30, follow_redirects=True) as c:
                r = c.get(url)
        except httpx.HTTPError as ex:
            raise HTTPException(status_code=502, detail=f"Could not fetch picture: {ex}") from ex
        ctype = r.headers.get("content-type", "")
        if r.status_code != 200 or not ctype.startswith("image/") or len(r.content) > MAX_BYTES:
            raise HTTPException(status_code=502, detail=f"Upstream returned {r.status_code} {ctype}")
        ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(ctype.split(";")[0], "bin")
        cached = _cache_dir() / f"{key}.{ext}"
        cached.write_bytes(r.content)
    media = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}.get(cached.suffix[1:], "application/octet-stream")
    return FileResponse(cached, media_type=media, headers={"Cache-Control": "public, max-age=604800", "Access-Control-Allow-Origin": "*"})
