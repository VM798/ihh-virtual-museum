"""Audio guide: a short spoken introduction to each inductee.

The script is assembled only from the profile's cited passages (summary, arrival, two achievements,
a legacy moment), so what the narrator says is traceable to the sources like everything else on the site.
``scripts/narrate.py`` turns the script into an MP3 with OpenAI text-to-speech when an API key is present;
without a file, the web app reads the same script aloud with the browser's own speech synthesis.
"""
from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel

from .config import get_settings
from .models import Inductee

WORDS_PER_MINUTE = 140


class Narration(BaseModel):
    slug: str
    title: str
    text: str
    paragraphs: list[str]
    source_ids: list[str]
    words: int
    seconds: int
    audio_url: str | None
    audio_generated_with: str | None


def audio_path(slug: str) -> Path:
    return get_settings().data_dir / "audio" / f"{slug}.mp3"


def _sentence(text: str) -> str:
    text = text.strip()
    return text if text.endswith((".", "!", "?")) else text + "."


def _plain(text: str) -> str:
    # Spoken text: no citation brackets, no double spaces.
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", text)).strip()


# Each guide follows one of several shapes so the ten do not sound alike. Chosen per inductee here;
# anyone added later gets a shape from a stable hash of the slug.
SHAPES = {
    "madeleine-albright": ("journey", "question", "rooms"),
    "irving-berlin":      ("quote", "facts", "invite"),
    "celia-cruz":         ("artifact", "journey", "rooms"),
    "albert-einstein":    ("legacy", "work", "ask"),
    "bob-hope":           ("artifact", "journey", "invite"),
    "hedy-lamarr":        ("question", "work", "rooms"),
    "john-muir":          ("artifact", "facts", "ask"),
    "james-naismith":     ("legacy", "journey", "invite"),
    "i-m-pei":            ("journey", "work", "ask"),
    "levi-strauss":       ("artifact", "work", "rooms"),
}
OPENINGS = ["journey", "quote", "artifact", "legacy", "question"]
MIDDLES = ["work", "journey", "facts", "question"]
CLOSINGS = ["rooms", "invite", "ask"]


def _shape(slug: str) -> tuple[str, str, str]:
    if slug in SHAPES:
        return SHAPES[slug]
    h = sum(ord(c) for c in slug)
    return OPENINGS[h % len(OPENINGS)], MIDDLES[(h // 7) % len(MIDDLES)], CLOSINGS[(h // 3) % len(CLOSINGS)]


def build_script(i: Inductee) -> Narration:
    """A spoken introduction written the way a docent would tell it, assembled only from the profile's cited passages.
    Nothing is invented: every fact comes from the summary, the arrival account, the achievements, the media, the timeline
    and the quotes. The order and framing vary by inductee (see SHAPES) so the ten guides do not sound alike."""
    surname = i.name.split()[-1]
    first = i.name.split()[0]
    country = i.origin.country.split(" (")[0]
    birthplace = i.born.place.split(",")[0]
    age = i.immigration.year - i.born.year
    opening, middle, closing = _shape(i.slug)
    sources: list[str] = []
    paras: list[str] = []
    used_quote = used_journey = used_work = used_legacy = False

    legacy = [e for e in i.timeline if e.category in ("legacy", "honor")]
    # For "jump ahead" moments prefer an honour or remembrance over the death notice itself.
    legacy = [e for e in legacy if not e.title.lower().startswith("dies")] or legacy
    artifacts = [m for m in i.media if m.kind in ("image", "document", "audio", "video") and m.description]

    def journey_para(lead: str) -> str:
        t = (f"{lead}{first} was born in {birthplace}, {country}, in {i.born.year}. {_plain(i.immigration.detail)}")
        if age > 0:
            t += f" {surname} was {age} years old on arriving in the United States."
        if i.citizenship_year and "citizen" not in t.lower():
            t += f" Citizenship came in {i.citizenship_year}."
        sources.extend(i.immigration.source_ids)
        return _sentence(t)

    def work_para(lead: str) -> str:
        picks = i.achievements[:2]
        parts = []
        for k, a in enumerate(picks):
            parts.append(_sentence(f"{'First, ' if k == 0 else 'And then, '}{a.title}{', in ' + str(a.year) if a.year else ''}. {_plain(a.description)}"))
            sources.extend(a.source_ids)
        return lead + " " + " ".join(parts)

    def quote_para(lead: str) -> str:
        q = i.quotes[0]
        sources.append(q.source_id)
        return f"{lead}\"{_plain(q.text)}\" {_plain(q.context)}."

    def legacy_para(lead: str) -> str:
        e = legacy[-1]
        sources.extend(e.source_ids)
        return _sentence(f"{lead}{e.year}. {_plain(e.description)}")

    # ---- opening
    if opening == "quote" and i.quotes:
        paras.append(quote_para("Listen to this first. ") + f" Those are the words of {i.name}: {i.tagline.rstrip('.')}. {i.summary.strip()}")
        used_quote = True
    elif opening == "artifact" and artifacts:
        m = artifacts[0]
        when = f", from {m.year}" if m.year and m.year not in m.title else ""
        paras.append(_sentence(f"Begin with an object. {m.title}{when}. {_plain(m.description)}") +
                     f" It belongs to the story of {i.name}: {i.tagline.rstrip('.')}. {i.summary.strip()}")
        if m.source_id:
            sources.append(m.source_id)
    elif opening == "legacy" and legacy:
        paras.append(legacy_para("Start at the end. The year is ") + f" How did {i.name} get there? {i.tagline.rstrip('.')}. {i.summary.strip()}")
        used_legacy = True
    elif opening == "question":
        paras.append(f"Here is a question to carry through this exhibit: what does the United States owe to a {age}-year-old who arrived from {country} in {i.immigration.year}? "
                     f"This is the story of {i.name}: {i.tagline.rstrip('.')}. {i.summary.strip()}")
    else:
        paras.append(f"Welcome. You are about to walk through the story of {i.name}: {i.tagline.rstrip('.')}. {i.summary.strip()}")
        paras.append(journey_para("Let's begin where every story in this museum begins: with a journey. "))
        used_journey = True

    # ---- middle
    if not used_journey:
        paras.append(journey_para("Now, the journey. " if opening != "question" else "The journey first. "))
        used_journey = True
    if middle == "facts" and i.fun_facts:
        f = i.fun_facts[0]
        sources.extend(f.source_ids)
        paras.append(_sentence(f"Here is something most visitors do not know. {_plain(f.text)}"))
        if i.achievements:
            paras.append(work_para(f"And the work itself? Two things stand out."))
            used_work = True
    elif middle == "question" and i.discussion_prompts:
        paras.append(work_para(f"So what did {surname} give to a new country? Here are two answers."))
        used_work = True
        paras.append(f"As you walk, keep one question in mind: {_plain(i.discussion_prompts[0])}")
    elif middle == "journey":
        if i.achievements:
            paras.append(work_para(f"What came next is the reason {surname} is honored here."))
            used_work = True
    else:
        paras.append(work_para(f"So what did {surname} give to a new country? Here are two answers."))
        used_work = True

    if not used_quote and i.quotes:
        paras.append(quote_para(f"Now listen to {surname}'s own words. "))
    if not used_legacy and legacy:
        paras.append(legacy_para("The story does not end with a lifetime. Jump ahead to "))

    # ---- closing
    rooms = ("the arrival, the personal story, the work, the artifacts and documents, "
             f"the history of the years {surname} arrived, the legacy, and the sources behind every word you have just heard")
    if closing == "invite":
        paras.append(f"Seven rooms are waiting: {rooms}. Walk them in any order. And when you are done, tell us your family's story. It belongs in this museum too.")
    elif closing == "ask":
        paras.append(f"If you have a question as you go, ask the docent in the artifacts room; every answer it gives is drawn from the same cited sources. "
                     f"The rooms ahead hold {rooms}. Enjoy the visit.")
    else:
        paras.append(f"That is the outline. The detail is waiting in the seven rooms ahead: {rooms}. Take your time.")

    text = "\n\n".join(paras)
    words = len(text.split())
    path = audio_path(i.slug)
    seen: list[str] = []
    for s in sources:
        if s not in seen:
            seen.append(s)
    return Narration(
        slug=i.slug, title=f"Audio guide: {i.name}", text=text, paragraphs=paras, source_ids=seen,
        words=words, seconds=round(words / WORDS_PER_MINUTE * 60) + 3 * len(paras),
        audio_url=f"/api/inductees/{i.slug}/narration.mp3" if path.exists() else None,
        audio_generated_with="OpenAI gpt-4o-mini-tts" if path.exists() else None,
    )
