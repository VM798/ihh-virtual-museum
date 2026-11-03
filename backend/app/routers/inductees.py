from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, HTMLResponse

from ..export import to_html, to_markdown
from ..models import Inductee, InducteeSummary, SearchHit

router = APIRouter(prefix="/api/inductees", tags=["inductees"])


@router.get("", response_model=list[InducteeSummary])
def list_inductees(request: Request, field: str | None = None, region: str | None = None, tag: str | None = None):
    return request.app.state.repo.summaries(field=field, region=region, tag=tag)


@router.get("/search", response_model=list[SearchHit])
def search(request: Request, q: str = Query(min_length=1, max_length=120), limit: int = Query(default=10, ge=1, le=50)):
    return request.app.state.repo.search(q, limit=limit)


@router.get("/{slug}", response_model=Inductee)
def get_inductee(request: Request, slug: str):
    inductee = request.app.state.repo.get(slug)
    if not inductee:
        raise HTTPException(status_code=404, detail=f"No inductee with slug '{slug}'")
    return inductee


@router.get("/{slug}/export.md", response_class=PlainTextResponse)
def export_markdown(request: Request, slug: str):
    inductee = request.app.state.repo.get(slug)
    if not inductee:
        raise HTTPException(status_code=404, detail=f"No inductee with slug '{slug}'")
    return PlainTextResponse(to_markdown(inductee), media_type="text/markdown; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="{slug}.md"'})


@router.get("/{slug}/export.html", response_class=HTMLResponse)
def export_html(request: Request, slug: str, download: bool = False):
    inductee = request.app.state.repo.get(slug)
    if not inductee:
        raise HTTPException(status_code=404, detail=f"No inductee with slug '{slug}'")
    headers = {"Content-Disposition": f'attachment; filename="{slug}.html"'} if download else {}
    return HTMLResponse(to_html(inductee), headers=headers)


@router.get("/{slug}/export.json", response_model=Inductee)
def export_json(request: Request, slug: str):
    inductee = request.app.state.repo.get(slug)
    if not inductee:
        raise HTTPException(status_code=404, detail=f"No inductee with slug '{slug}'")
    return inductee
