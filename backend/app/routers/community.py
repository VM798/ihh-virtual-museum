"""Visitor contributions: immigration stories shared by the public, and contact-form messages.

Submissions are appended to JSON files under data/community/. Stories are stored with
status "pending" so the IHH team can review them before anything is published; the
public listing omits e-mail addresses.
"""
from __future__ import annotations

import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from ..config import get_settings
from .auth import current_user, require_user

router = APIRouter(prefix="/api", tags=["community"])
_lock = threading.Lock()

StoryType = Literal["contemporary", "legacy", "what-we-bring"]
STORY_TYPE_LABELS: dict[StoryType, str] = {
    "contemporary": "Contemporary immigrant story",
    "legacy": "Immigrant legacy story",
    "what-we-bring": "What we bring with us",
}
CONTACT_TOPICS = ["General question", "Classroom visit", "Donations", "Beyond the Stories", "Partnerships", "Volunteering", "Board service", "Press"]


def _community_dir() -> Path:
    d = get_settings().data_dir / "community"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read(name: str) -> list[dict]:
    path = _community_dir() / name
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _append(name: str, item: dict) -> None:
    with _lock:
        items = _read(name)
        items.append(item)
        (_community_dir() / name).write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


class StoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120, description="Full name of the person submitting")
    display_name: str | None = Field(default=None, max_length=120, description="How the name should appear on the site")
    email: EmailStr
    origin_country: str = Field(min_length=2, max_length=120)
    origin_flag: str | None = Field(default=None, max_length=8)
    arrival_year: int | None = Field(default=None, ge=1600, le=2100)
    story_type: StoryType = "contemporary"
    title: str = Field(min_length=3, max_length=160)
    story: str = Field(min_length=40, max_length=10_000)
    consent: bool

    @field_validator("consent")
    @classmethod
    def must_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Consent to share the story is required")
        return v


class Story(BaseModel):
    id: str
    display_name: str
    origin_country: str
    origin_flag: str | None
    arrival_year: int | None
    story_type: StoryType
    story_type_label: str
    title: str
    story: str
    status: Literal["pending", "approved", "declined"]
    submitted_at: str


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    topics: list[str] = Field(default_factory=list, max_length=len(CONTACT_TOPICS))
    message: str = Field(min_length=10, max_length=5_000)


class ContactOut(BaseModel):
    id: str
    received_at: str


def _public(story: dict) -> Story:
    return Story(**{k: v for k, v in story.items() if k not in {"email", "user_id"}})


@router.get("/stories", response_model=list[Story], summary="Immigration stories shared by visitors")
def list_stories(request: Request, status: str | None = None, limit: int = 50):
    stories = sorted(_read("stories.json"), key=lambda s: s["submitted_at"], reverse=True)
    if status:
        stories = [s for s in stories if s["status"] == status]
    return [_public(s) for s in stories[: max(1, min(limit, 200))]]


@router.get("/stories/mine", response_model=list[Story], summary="Stories shared by the signed-in visitor")
def my_stories(request: Request):
    user = require_user(request)
    mine = [s for s in _read("stories.json") if s.get("user_id") == user["id"]]
    return [_public(s) for s in sorted(mine, key=lambda s: s["submitted_at"], reverse=True)]


@router.get("/stories/types", summary="Story categories, matching the IHH 'Tell Your Story' form")
def story_types():
    return [{"id": k, "label": v} for k, v in STORY_TYPE_LABELS.items()]


@router.post("/stories", response_model=Story, status_code=201, summary="Share your own immigration story")
def submit_story(payload: StoryIn, request: Request):
    user = current_user(request)
    title, story = _clean(payload.title), payload.story.strip()
    if not story:
        raise HTTPException(status_code=422, detail="The story text is empty")
    item = {
        "id": uuid4().hex[:12],
        "name": _clean(payload.name),
        "display_name": _clean(payload.display_name) if payload.display_name and payload.display_name.strip() else _clean(payload.name),
        "email": str(payload.email),
        "origin_country": _clean(payload.origin_country),
        "origin_flag": payload.origin_flag,
        "arrival_year": payload.arrival_year,
        "story_type": payload.story_type,
        "story_type_label": STORY_TYPE_LABELS[payload.story_type],
        "title": title,
        "story": story,
        "user_id": user["id"] if user else None,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _append("stories.json", item)
    return _public(item)


@router.get("/contact/topics", summary="Inquiry types offered on the contact form")
def contact_topics():
    return CONTACT_TOPICS


@router.post("/contact", response_model=ContactOut, status_code=201, summary="Send a message to the IHH team")
def submit_contact(payload: ContactIn):
    unknown = [t for t in payload.topics if t not in CONTACT_TOPICS]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown topics: {', '.join(unknown)}")
    item = {
        "id": uuid4().hex[:12],
        "name": _clean(payload.name),
        "email": str(payload.email),
        "phone": _clean(payload.phone) if payload.phone else None,
        "topics": payload.topics,
        "message": payload.message.strip(),
        "received_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _append("contact.json", item)
    return ContactOut(id=item["id"], received_at=item["received_at"])
