"""AI features grounded in the cited profile content.

* ``ask``      – the AI Docent answers a visitor's question using only the profile's cited
                 passages, returning inline [S#] citations the visitor can check.
* ``annotate`` – drafts a museum-label annotation for a media item (looking at the image
                 when there is one). Drafts are clearly marked for editorial review.

Both call OpenAI through the official SDK when ``OPENAI_API_KEY`` is configured. Without a
key the docent falls back to keyword retrieval over the same cited passages, so the site
keeps working offline, and annotation reports that it is unavailable.
"""
from __future__ import annotations

import logging
import os
import re

from .config import get_settings
from .models import DocentAnswer, Inductee, Media

log = logging.getLogger(__name__)

DOCENT_INSTRUCTIONS = """You are the AI Docent of the Immigrant Hall of Honor virtual museum.
You answer questions from museum visitors, many of them students, about one inductee.

Rules:
- Use ONLY the profile passages supplied in the message. Every passage is tagged with
  source ids like [S3]. Cite the ids you relied on inline, e.g. "...in 1942 [S2][S5]".
- If the passages do not contain the answer, say so plainly and suggest which listed source
  the visitor could consult. Never invent dates, quotes or facts.
- Keep answers under 180 words, warm and clear for a general audience aged 12 and up.
- Finish with a line "Sources used: S1, S4" listing only the ids you cited."""

ANNOTATION_INSTRUCTIONS = """You write museum label text for the Immigrant Hall of Honor virtual museum.
Given an artifact or media item and the cited profile of the inductee it relates to, write:
1. A label of 60-90 words that helps a visitor aged 12 and up understand what they are looking
   at and why it matters to the inductee's immigrant story. Describe only what is visible or
   documented in the supplied material; do not invent details.
2. One 'Look closer' prompt (a single sentence) that directs attention to a detail.
Return plain text with the label first, then a blank line, then "Look closer: ...".
Every factual statement must be supported by the supplied passages; cite them inline as [S#]."""


# ----------------------------------------------------------------------------- context
def _passages(i: Inductee) -> list[tuple[str, list[str]]]:
    out: list[tuple[str, list[str]]] = []
    out.append((f"{i.name} (born {i.birth_name}), {i.tagline}. Born {i.born.date or i.born.year} in {i.born.place}."
                + (f" Died {i.died.date or i.died.year} in {i.died.place}." if i.died else "")
                + f" Immigrated {i.immigration.year} to {i.immigration.arrived}: {i.immigration.detail}", i.immigration.source_ids))
    for p in i.biography:
        out.append((p.text, p.source_ids))
    for a in i.achievements:
        out.append((f"Achievement: {a.title} ({a.year or 'n.d.'}) — {a.description}", a.source_ids))
    for h in i.honors:
        out.append((f"Honor: {h.title} ({h.year or 'n.d.'})", h.source_ids))
    for ev in i.timeline:
        out.append((f"Timeline {ev.date or ev.year}: {ev.title} — {ev.description}", ev.source_ids))
    for q in i.quotes:
        out.append((f"Quote: “{q.text}” ({q.context})", [q.source_id]))
    for f in i.fun_facts:
        out.append((f"Did you know: {f.text}", f.source_ids))
    return out


def _context_block(i: Inductee) -> str:
    lines = [f"PROFILE OF {i.name.upper()}", ""]
    for text, ids in _passages(i):
        lines.append(f"{text} {''.join(f'[{s}]' for s in ids)}".strip())
    lines += ["", "SOURCE LIST"]
    for s in i.sources:
        lines.append(f"[{s.id}] {s.title} — {s.publisher} ({s.url})")
    return "\n".join(lines)


def _has_credentials() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def _extract_citations(text: str, i: Inductee) -> list[str]:
    known = {s.id for s in i.sources}
    cited: list[str] = []
    for sid in re.findall(r"\bS\d+\b", text):
        if sid in known and sid not in cited:
            cited.append(sid)
    return cited


# ----------------------------------------------------------------------------- fallback
def _retrieval_fallback(i: Inductee, question: str, note: str | None = None) -> DocentAnswer:
    default_note = "AI docent is running in offline mode (no OpenAI API key configured); answers are retrieved passages."
    stop = {"what", "when", "where", "which", "about", "does", "did", "this", "that", "with", "from", "were", "have",
            "their", "they", "them", "why", "how", "who", "was", "the", "and", "for"}
    terms = {t for t in re.split(r"\W+", question.lower()) if len(t) > 2} - stop
    scored: list[tuple[int, str, list[str]]] = []
    for text, ids in _passages(i):
        low = text.lower()
        score = sum(low.count(t) for t in terms)
        if score:
            scored.append((score, text, ids))
    scored.sort(key=lambda x: -x[0])
    top = scored[:3]
    if not top:
        return DocentAnswer(
            answer=f"I could not find that in {i.name}'s profile. Try the sources listed below the biography, "
                   f"starting with {i.sources[0].title} ({i.sources[0].publisher}).",
            cited_source_ids=[], model=None, grounded=True, note=note or default_note)
    cited: list[str] = []
    for _, _, ids in top:
        for s in ids:
            if s not in cited:
                cited.append(s)
    answer = "Here is what the profile says:\n\n" + "\n\n".join(f"• {t} {''.join(f'[{s}]' for s in ids)}" for _, t, ids in top)
    return DocentAnswer(answer=answer, cited_source_ids=cited, model=None, grounded=True, note=note or default_note)


# ----------------------------------------------------------------------------- OpenAI
def _client():
    from openai import OpenAI
    return OpenAI()


def ask(i: Inductee, question: str) -> DocentAnswer:
    settings = get_settings()
    if not settings.docent_enabled or not _has_credentials():
        return _retrieval_fallback(i, question)
    import openai

    try:
        response = _client().responses.create(
            model=settings.docent_model,
            instructions=DOCENT_INSTRUCTIONS,
            input=[{"role": "user", "content": [
                {"type": "input_text", "text": _context_block(i)},
                {"type": "input_text", "text": f"Visitor question: {question}"},
            ]}],
            max_output_tokens=600,
        )
    except openai.AuthenticationError:
        log.warning("OpenAI credentials rejected; using retrieval fallback")
        return _retrieval_fallback(i, question, "The AI docent's credentials were rejected; showing matching passages instead.")
    except openai.RateLimitError:
        return _retrieval_fallback(i, question, "The AI docent is busy right now; showing matching passages from the profile instead.")
    except openai.APIStatusError as exc:
        log.error("OpenAI API error %s: %s", exc.status_code, exc.message)
        return _retrieval_fallback(i, question, "The AI docent is temporarily unavailable; showing matching passages instead.")
    except openai.APIConnectionError:
        return _retrieval_fallback(i, question, "Could not reach the AI service; showing matching passages instead.")

    text = (response.output_text or "").strip()
    if not text:
        return _retrieval_fallback(i, question, "The AI docent returned no answer; showing matching passages instead.")
    return DocentAnswer(answer=text, cited_source_ids=_extract_citations(text, i), model=response.model, grounded=True)


def annotate(i: Inductee, media: Media) -> DocentAnswer:
    settings = get_settings()
    if not settings.docent_enabled or not _has_credentials():
        return DocentAnswer(answer="", cited_source_ids=[], model=None, grounded=False,
                            note="Annotation drafting needs an OpenAI API key; none is configured.")
    import openai

    content: list[dict] = [
        {"type": "input_text", "text": _context_block(i)},
        {"type": "input_text", "text": (
            f"MEDIA ITEM\nTitle: {media.title}\nKind: {media.kind}\nYear: {media.year or 'unknown'}\n"
            f"Description: {media.description}\nCredit: {media.credit}\nLicense: {media.license}\n"
            + (f"Existing curator note: {media.annotation}\n" if media.annotation else "")
            + "\nWrite the label now.")},
    ]
    image_url = media.embed_url if media.kind == "image" else media.thumbnail
    if image_url and media.kind == "image":
        content.insert(1, {"type": "input_image", "image_url": image_url, "detail": "low"})
    try:
        response = _client().responses.create(
            model=settings.annotation_model,
            instructions=ANNOTATION_INSTRUCTIONS,
            input=[{"role": "user", "content": content}],
            max_output_tokens=500,
        )
    except openai.APIStatusError as exc:
        log.error("OpenAI API error %s: %s", exc.status_code, exc.message)
        return DocentAnswer(answer="", cited_source_ids=[], model=None, grounded=False,
                            note=f"Annotation drafting failed ({exc.status_code}). Try again later.")
    except openai.APIConnectionError:
        return DocentAnswer(answer="", cited_source_ids=[], model=None, grounded=False, note="Could not reach the AI service.")
    text = (response.output_text or "").strip()
    return DocentAnswer(answer=text, cited_source_ids=_extract_citations(text, i), model=response.model, grounded=True,
                        note="AI-drafted label. Review against the cited sources before publishing.")
