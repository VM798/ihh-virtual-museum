from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .. import chat, docent
from ..config import get_settings
from ..models import DocentAnswer, DocentQuestion

router = APIRouter(prefix="/api/docent", tags=["docent"])


class AnnotateRequest(BaseModel):
    slug: str
    media_id: str = Field(min_length=1, max_length=20)


@router.post("/ask", response_model=DocentAnswer)
def ask(request: Request, payload: DocentQuestion):
    inductee = request.app.state.repo.get(payload.slug)
    if not inductee:
        raise HTTPException(status_code=404, detail=f"No inductee with slug '{payload.slug}'")
    return docent.ask(inductee, payload.question)


@router.post("/annotate", response_model=DocentAnswer)
def annotate(request: Request, payload: AnnotateRequest):
    inductee = request.app.state.repo.get(payload.slug)
    if not inductee:
        raise HTTPException(status_code=404, detail=f"No inductee with slug '{payload.slug}'")
    media = next((m for m in inductee.media if m.id == payload.media_id), None)
    if not media:
        raise HTTPException(status_code=404, detail=f"No media '{payload.media_id}' for {payload.slug}")
    return docent.annotate(inductee, media)


@router.get("/status")
def status():
    settings = get_settings()
    live = settings.docent_enabled and docent._has_credentials()
    return {"enabled": settings.docent_enabled, "model": settings.docent_model,
            "annotation_model": settings.annotation_model, "live": live, "provider": "openai"}


@router.post("/chat", response_model=chat.ChatReply, summary="Museum guide: chat about any inductee or the site")
def museum_chat(request: Request, payload: chat.ChatRequest):
    if payload.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must come from the visitor")
    return chat.reply(request.app.state.repo, payload)
