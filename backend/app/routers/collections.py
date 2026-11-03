from __future__ import annotations

from fastapi import APIRouter, Request

from ..models import GlobalTimelineEvent, SourceWithOwner, Stats

router = APIRouter(prefix="/api", tags=["collections"])


@router.get("/timeline", response_model=list[GlobalTimelineEvent])
def global_timeline(request: Request):
    return request.app.state.repo.global_timeline()


@router.get("/sources", response_model=list[SourceWithOwner])
def all_sources(request: Request, kind: str | None = None, status: str | None = None):
    sources = request.app.state.repo.sources()
    if kind:
        sources = [s for s in sources if s.kind == kind]
    if status:
        sources = [s for s in sources if s.verification.status == status]
    return sources


@router.get("/stats", response_model=Stats)
def stats(request: Request):
    return request.app.state.repo.stats()
