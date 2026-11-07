"""Loads inductee JSON files from disk and answers read queries over them."""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

from .models import (
    EventImage, ExploreLink, GlobalTimelineEvent, HistoricalContext, Inductee, InducteeSummary, SearchHit, SourceWithOwner, Stats, Verification,
)


class Repository:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self._inductees: dict[str, Inductee] = {}
        self._order: list[str] = []
        self.load()

    # ---------------------------------------------------------------- loading
    def load(self) -> None:
        verification = self._load_verification()
        scenes = self._load_scenes()
        context = self._load_context()
        self.explore_links: list[ExploreLink] = [ExploreLink.model_validate(x) for x in context.get("explore_further", [])]
        eras = [(e, HistoricalContext.model_validate({k: v for k, v in e.items() if k not in ("from", "to")})) for e in context.get("eras", [])]
        items: list[Inductee] = []
        for path in sorted((self.data_dir / "inductees").glob("*.json")):
            raw = json.loads(path.read_text(encoding="utf-8"))
            inductee = Inductee.model_validate(raw)
            for source in inductee.sources:
                if source.url in verification:
                    source.verification = Verification.model_validate(verification[source.url])
            # Scene pictures for the timeline (scripts/find_scenes.py) live in scenes.json, keyed by moment.
            for raw_era, era in eras:
                if raw_era["from"] <= inductee.immigration.year <= raw_era["to"]:
                    inductee.historical_context = era
                    break
            for scene in scenes.get(inductee.slug, []):
                for event in inductee.timeline:
                    if event.year == scene["year"] and event.title.lower().startswith(scene["title"].lower()):
                        event.image = EventImage.model_validate(scene["image"])
                        break
            items.append(inductee)
        items.sort(key=lambda i: i.name.split()[-1])
        self._inductees = {i.slug: i for i in items}
        self._order = [i.slug for i in items]

    def _load_context(self) -> dict:
        path = self.data_dir / "context.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def _load_scenes(self) -> dict[str, list[dict]]:
        path = self.data_dir / "scenes.json"
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8")).get("scenes", {})

    def _load_verification(self) -> dict[str, dict]:
        path = self.data_dir / "verification.json"
        if not path.exists():
            return {}
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("results", {})

    # ---------------------------------------------------------------- queries
    def all(self) -> list[Inductee]:
        return [self._inductees[s] for s in self._order]

    def get(self, slug: str) -> Inductee | None:
        return self._inductees.get(slug)

    def summaries(self, field: str | None = None, region: str | None = None, tag: str | None = None) -> list[InducteeSummary]:
        out = []
        for i in self.all():
            if field and i.field.lower() != field.lower():
                continue
            if region and i.origin.region.lower() != region.lower():
                continue
            if tag and tag.lower() not in {t.lower() for t in i.tags}:
                continue
            out.append(InducteeSummary.from_inductee(i))
        return out

    def global_timeline(self) -> list[GlobalTimelineEvent]:
        events: list[GlobalTimelineEvent] = []
        for i in self.all():
            for e in i.timeline:
                events.append(GlobalTimelineEvent(
                    **e.model_dump(), slug=i.slug, name=i.name, accent=i.accent, thumbnail=i.hero_image.thumbnail,
                ))
        events.sort(key=lambda e: (e.year, e.date or "", e.name))
        return events

    def sources(self) -> list[SourceWithOwner]:
        out: list[SourceWithOwner] = []
        for i in self.all():
            for s in i.sources:
                out.append(SourceWithOwner(**s.model_dump(), inductee_slug=i.slug, inductee_name=i.name))
        return out

    def stats(self) -> Stats:
        items = self.all()
        sources = self.sources()
        years = [i.born.year for i in items] + [i.died.year for i in items if i.died]
        return Stats(
            inductees=len(items),
            sources=len(sources),
            verified_sources=sum(1 for s in sources if s.verification.status == "ok"),
            media=sum(len(i.media) for i in items),
            timeline_events=sum(len(i.timeline) for i in items),
            countries=len({i.origin.country for i in items}),
            span_start=min(years) if years else date.today().year,
            span_end=max(years) if years else date.today().year,
            fields=dict(Counter(i.field for i in items)),
            regions=dict(Counter(i.origin.region for i in items)),
        )

    def search(self, query: str, limit: int = 10) -> list[SearchHit]:
        q = query.strip().lower()
        if not q:
            return []
        terms = [t for t in re.split(r"\W+", q) if t]
        hits: list[SearchHit] = []
        for i in self.all():
            fields: dict[str, str] = {
                "name": f"{i.name} {i.birth_name}",
                "tagline": i.tagline,
                "field": f"{i.field} {' '.join(i.tags)} {' '.join(i.occupations)}",
                "origin": f"{i.origin.country} {i.origin.place}",
                "summary": i.summary,
                "biography": " ".join(p.text for p in i.biography),
                "achievements": " ".join(f"{a.title} {a.description}" for a in i.achievements),
                "honors": " ".join(h.title for h in i.honors),
                "timeline": " ".join(f"{e.title} {e.description}" for e in i.timeline),
                "quotes": " ".join(x.text for x in i.quotes),
            }
            weights = {"name": 50, "tagline": 20, "field": 15, "origin": 15, "summary": 8,
                       "biography": 4, "achievements": 5, "honors": 4, "timeline": 3, "quotes": 3}
            score = 0
            matched: list[str] = []
            snippet = ""
            for key, text in fields.items():
                low = text.lower()
                count = sum(low.count(t) for t in terms)
                if count:
                    score += weights[key] * min(count, 5)
                    matched.append(key)
                    if not snippet and key not in {"name", "field", "origin"}:
                        idx = min((low.find(t) for t in terms if low.find(t) >= 0), default=0)
                        start = max(0, idx - 80)
                        snippet = ("…" if start else "") + text[start:idx + 140].strip() + "…"
            if score:
                hits.append(SearchHit(slug=i.slug, name=i.name, thumbnail=i.hero_image.thumbnail, accent=i.accent,
                                      score=score, matched_in=matched, snippet=snippet or i.summary))
        hits.sort(key=lambda h: -h.score)
        return hits[:limit]
