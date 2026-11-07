"""Pydantic models describing an inductee profile and its evidence trail.

Every factual element (biography paragraph, achievement, timeline event, quote)
carries ``source_ids`` that point into the inductee's ``sources`` list, so the
IHH communications team can trace each claim back to a verifiable reference.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

SourceKind = Literal[
    "official", "government", "archive", "academic", "museum",
    "encyclopedia", "patent", "press", "organization",
]
MediaKind = Literal["image", "audio", "video", "document"]
EventCategory = Literal["origins", "immigration", "career", "milestone", "honor", "legacy"]


class Verification(BaseModel):
    """Result of the most recent link check for a source URL."""
    method: Literal["http", "manual", "unchecked"] = "unchecked"
    status: Literal["ok", "blocked", "redirect", "error", "unchecked"] = "unchecked"
    http_status: int | None = None
    checked_at: str | None = None
    note: str | None = None


class Source(BaseModel):
    id: str
    title: str
    publisher: str
    url: str
    kind: SourceKind
    access: Literal["open", "registration", "paid"] = "open"
    note: str | None = None
    verification: Verification = Field(default_factory=Verification)


class Media(BaseModel):
    id: str
    kind: MediaKind
    title: str
    url: str = Field(description="Landing page for the resource (where rights are stated)")
    embed_url: str | None = Field(default=None, description="Direct file URL that can be embedded")
    thumbnail: str | None = None
    year: str | None = None
    credit: str
    license: str
    license_url: str | None = None
    description: str
    annotation: str | None = Field(default=None, description="Curated museum-label annotation")
    rights_note: str | None = Field(default=None, description="Caveats the website team must check before publishing")
    source_id: str | None = None


class Paragraph(BaseModel):
    text: str
    source_ids: list[str] = Field(default_factory=list)


class Achievement(BaseModel):
    title: str
    year: str | None = None
    description: str
    source_ids: list[str] = Field(default_factory=list)


class Honor(BaseModel):
    title: str
    year: int | None = None
    source_ids: list[str] = Field(default_factory=list)


class EventImage(BaseModel):
    """An archival picture that illustrates a moment: the inductee's own media or a dated image of the setting."""
    url: str
    thumbnail: str | None = None
    title: str
    credit: str
    license: str
    source_url: str
    year: int | None = None


class TimelineEvent(BaseModel):
    year: int
    date: str | None = None
    title: str
    description: str
    category: EventCategory
    source_ids: list[str] = Field(default_factory=list)
    image: EventImage | None = None


class Quote(BaseModel):
    text: str
    context: str
    source_id: str


class FunFact(BaseModel):
    text: str
    source_ids: list[str] = Field(default_factory=list)


class ReviewNote(BaseModel):
    """A discrepancy between the current IHH web page and primary sources."""
    ihh_statement: str
    finding: str
    severity: Literal["correction", "clarification", "unverified"]
    source_ids: list[str] = Field(default_factory=list)


class LifeEvent(BaseModel):
    year: int
    date: str | None = None
    place: str


class Origin(BaseModel):
    country: str
    place: str
    flag: str = Field(description="Emoji flag for the country of origin")
    region: Literal["Europe", "Asia", "The Americas", "Africa", "Oceania"]


class Immigration(BaseModel):
    year: int
    arrived: str
    detail: str
    source_ids: list[str] = Field(default_factory=list)


class HeroImage(BaseModel):
    url: str
    thumbnail: str
    credit: str
    license: str
    license_url: str | None = None
    source_url: str


class ContextSource(BaseModel):
    title: str
    publisher: str
    url: str


class HistoricalContext(BaseModel):
    """What U.S. immigration looked like when this inductee arrived (data/context.json, matched by immigration year)."""
    id: str
    title: str
    span: str
    text: str
    sources: list[ContextSource]


class ExploreLink(BaseModel):
    title: str
    publisher: str
    url: str
    note: str | None = None


class MuseumItem(BaseModel):
    id: str
    kind: str
    title: str
    year: str | None
    description: str
    credit: str
    license: str
    url: str
    thumbnail: str


class MuseumBay(BaseModel):
    """One alcove of the walkable hall: the inductee's portrait, nameplate facts and up to three artifacts."""
    slug: str
    name: str
    tagline: str
    field: str
    accent: str
    origin_flag: str
    origin_country: str
    born_year: int
    died_year: int | None
    immigration_year: int
    portrait: str
    portrait_credit: str
    summary: str
    items: list[MuseumItem]
    scenes: list[MuseumItem] = Field(default_factory=list, description="Dated pictures from the timeline, for the salon wall")
    featured: MuseumItem | None = Field(default=None, description="The object in the display case in front of the bay")


class Inductee(BaseModel):
    slug: str
    name: str
    birth_name: str
    tagline: str
    field: str
    tags: list[str] = Field(default_factory=list)
    accent: str = Field(description="Hex colour used for this inductee's visual identity")
    born: LifeEvent
    died: LifeEvent | None = None
    origin: Origin
    immigration: Immigration
    citizenship_year: int | None = None
    occupations: list[str]
    hero_image: HeroImage
    summary: str
    biography: list[Paragraph]
    achievements: list[Achievement]
    honors: list[Honor]
    timeline: list[TimelineEvent]
    quotes: list[Quote] = Field(default_factory=list)
    fun_facts: list[FunFact] = Field(default_factory=list)
    discussion_prompts: list[str] = Field(default_factory=list)
    media: list[Media] = Field(default_factory=list)
    review_notes: list[ReviewNote] = Field(default_factory=list)
    sources: list[Source]
    ihh_page_url: str
    wikipedia_url: str
    historical_context: HistoricalContext | None = None

    @model_validator(mode="after")
    def _check_source_references(self) -> "Inductee":
        known = {s.id for s in self.sources}
        if len(known) != len(self.sources):
            raise ValueError(f"{self.slug}: duplicate source ids")
        referenced: set[str] = set()

        def collect(ids: list[str]) -> None:
            for sid in ids:
                if sid not in known:
                    raise ValueError(f"{self.slug}: unknown source id '{sid}'")
                referenced.add(sid)

        collect(self.immigration.source_ids)
        for p in self.biography:
            collect(p.source_ids)
        for a in self.achievements:
            collect(a.source_ids)
        for h in self.honors:
            collect(h.source_ids)
        for e in self.timeline:
            collect(e.source_ids)
        for q in self.quotes:
            collect([q.source_id])
        for f in self.fun_facts:
            collect(f.source_ids)
        for n in self.review_notes:
            collect(n.source_ids)
        for m in self.media:
            if m.source_id:
                collect([m.source_id])
        media_ids = [m.id for m in self.media]
        if len(set(media_ids)) != len(media_ids):
            raise ValueError(f"{self.slug}: duplicate media ids")
        self.timeline.sort(key=lambda e: (e.year, e.date or ""))
        return self


class InducteeSummary(BaseModel):
    slug: str
    name: str
    tagline: str
    field: str
    tags: list[str]
    accent: str
    born_year: int
    died_year: int | None
    origin_country: str
    origin_flag: str
    origin_region: str
    immigration_year: int
    thumbnail: str
    summary: str
    source_count: int
    media_count: int
    event_count: int

    @classmethod
    def from_inductee(cls, i: Inductee) -> "InducteeSummary":
        return cls(
            slug=i.slug, name=i.name, tagline=i.tagline, field=i.field, tags=i.tags,
            accent=i.accent, born_year=i.born.year, died_year=i.died.year if i.died else None,
            origin_country=i.origin.country, origin_flag=i.origin.flag, origin_region=i.origin.region,
            immigration_year=i.immigration.year, thumbnail=i.hero_image.thumbnail, summary=i.summary,
            source_count=len(i.sources), media_count=len(i.media), event_count=len(i.timeline),
        )


class GlobalTimelineEvent(TimelineEvent):
    slug: str
    name: str
    accent: str
    thumbnail: str


class SourceWithOwner(Source):
    inductee_slug: str
    inductee_name: str


class Stats(BaseModel):
    inductees: int
    sources: int
    verified_sources: int
    media: int
    timeline_events: int
    countries: int
    span_start: int
    span_end: int
    fields: dict[str, int]
    regions: dict[str, int]


class SearchHit(BaseModel):
    slug: str
    name: str
    thumbnail: str
    accent: str
    score: int
    matched_in: list[str]
    snippet: str


class DocentQuestion(BaseModel):
    slug: str
    question: str = Field(min_length=3, max_length=500)


class DocentAnswer(BaseModel):
    answer: str
    cited_source_ids: list[str]
    model: str | None
    grounded: bool
    note: str | None = None
