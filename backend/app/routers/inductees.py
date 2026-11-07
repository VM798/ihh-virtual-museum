from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse

from ..export import to_html, to_lesson_markdown, to_markdown
from ..models import Inductee, InducteeSummary, SearchHit
from ..narration import Narration, audio_path, build_script

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


@router.get("/{slug}/lesson.md", response_class=PlainTextResponse, summary="Classroom packet (Markdown)")
def export_lesson(request: Request, slug: str):
    inductee = request.app.state.repo.get(slug)
    if not inductee:
        raise HTTPException(status_code=404, detail="Inductee not found")
    return PlainTextResponse(to_lesson_markdown(inductee), media_type="text/markdown; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="{slug}-classroom-packet.md"'})


@router.get("/{slug}/narration", response_model=Narration, summary="Audio-guide script built from cited passages")
def narration(request: Request, slug: str):
    inductee = request.app.state.repo.get(slug)
    if not inductee:
        raise HTTPException(status_code=404, detail="Inductee not found")
    return build_script(inductee)


@router.get("/{slug}/narration.mp3", summary="Audio guide (generated with scripts/narrate.py)")
def narration_audio(request: Request, slug: str):
    if not request.app.state.repo.get(slug):
        raise HTTPException(status_code=404, detail="Inductee not found")
    path = audio_path(slug)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not generated yet; run scripts/narrate.py with an OpenAI key")
    return FileResponse(path, media_type="audio/mpeg", filename=f"{slug}-audio-guide.mp3")


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
