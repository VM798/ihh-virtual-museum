from __future__ import annotations

from fastapi import APIRouter, Request

from ..models import ExploreLink, GlobalTimelineEvent, MuseumBay, MuseumItem, SourceWithOwner, Stats

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


@router.get("/explore", response_model=list[ExploreLink], summary="Other museums and archives worth exploring")
def explore_links(request: Request):
    return request.app.state.repo.explore_links


@router.get("/museum", response_model=list[MuseumBay], summary="Contents of the walkable 3D hall, one bay per inductee")
def museum(request: Request):
    bays = []
    for i in request.app.state.repo.all():
        items = [MuseumItem(id=m.id, kind=m.kind, title=m.title, year=m.year, description=m.description, credit=m.credit,
                            license=m.license, url=m.url, thumbnail=m.thumbnail)
                 for m in i.media if m.thumbnail][:4]
        scenes = [MuseumItem(id=f"scene-{k}", kind="picture", title=f"{e.title}, {e.year}", year=str(e.image.year or e.year),
                             description=e.description, credit=e.image.credit, license=e.image.license, url=e.image.source_url,
                             thumbnail=e.image.thumbnail or e.image.url)
                  for k, e in enumerate(i.timeline) if e.image and e.image.thumbnail
                  and e.image.thumbnail not in {m.thumbnail for m in items} and e.image.thumbnail != i.hero_image.thumbnail][:5]
        featured = next((m for m in items if m.kind == "document"), next((m for m in items if m.kind == "image"), None))
        bays.append(MuseumBay(
            slug=i.slug, name=i.name, tagline=i.tagline, field=i.field, accent=i.accent, origin_flag=i.origin.flag,
            origin_country=i.origin.country.split(" (")[0], born_year=i.born.year, died_year=i.died.year if i.died else None,
            immigration_year=i.immigration.year, portrait=i.hero_image.thumbnail,
            portrait_credit=f"{i.hero_image.credit} · {i.hero_image.license}", summary=i.summary, items=items, scenes=scenes, featured=featured,
        ))
    return bays
