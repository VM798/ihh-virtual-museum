"""The museum guide: a site-wide chatbot grounded in the cited inductee profiles.

Unlike the per-profile docent, the guide can talk about any inductee and about the
museum itself (how to walk the hall, share a story, book a classroom visit, use kids
mode). Each turn it retrieves the most relevant inductee profiles for the question,
remembers which inductees the conversation has mentioned so follow-ups like "where was
she born?" keep working, and answers from those passages only.

With ``OPENAI_API_KEY`` set the answer is written by the model; without a key the guide
falls back to keyword retrieval over the same passages, so it works offline.
"""
from __future__ import annotations

import logging
import re
from typing import Literal

from pydantic import BaseModel, Field

from .config import get_settings
from .docent import _context_block, _has_credentials, _passages
from .models import Inductee
from .repository import Repository

log = logging.getLogger(__name__)

Role = Literal["user", "assistant"]


class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    page: str | None = Field(default=None, max_length=200, description="Path the visitor is on, e.g. /inductees/i-m-pei")


class ChatLink(BaseModel):
    label: str
    to: str


class ChatReply(BaseModel):
    answer: str
    links: list[ChatLink] = []
    inductees: list[str] = Field(default_factory=list, description="Slugs the answer drew on")
    cited_source_ids: list[str] = []
    model: str | None = None
    note: str | None = None


# --- what the guide knows about the site itself ------------------------------------
SITE_PAGES: list[tuple[str, str, str, list[str]]] = [
    # (label, path, description, keywords)
    ("Walk the museum", "/museum", "A 3D hall you can walk through: one bay per inductee with their portrait, archive pictures and a display case. Click the floor to walk, drag to look around, scroll to move, pinch to zoom, and click any picture to open it.",
     ["museum", "hall", "walk", "3d", "gallery", "navigate", "move", "zoom", "controls", "arrow", "drag", "virtual"]),
    ("Meet the inductees", "/inductees", "Profiles of every inductee, sortable A to Z, with cited biographies, timelines, artifacts and an audio guide.",
     ["inductee", "inductees", "who is in", "list", "everyone", "people", "profiles", "a to z", "alphabet"]),
    ("Travel the timeline", "/timeline", "A story-mode timeline for each inductee: drag the ruler through their life and the scene pictures change with each moment.",
     ["timeline", "dates", "chronology", "years", "when"]),
    ("Share a story", "/share", "Any visitor can submit their own or their family's immigration story. Stories are reviewed by the IHH team before publication.",
     ["share", "story", "submit", "my story", "family story", "tell", "contribute", "upload"]),
    ("For educators", "/educators", "Classroom packets for every inductee (summary, key dates, primary sources, discussion prompts, activities), plus live virtual visits.",
     ["teacher", "educator", "classroom", "lesson", "packet", "school", "students", "curriculum", "class"]),
    ("Kids mode", "/educators/kids", "A guided mode for younger visitors with Scout the suitcase: story cards, read-aloud, a short quiz and a passport of stamps.",
     ["kid", "kids", "child", "children", "scout", "quiz", "passport", "stamps", "young", "elementary"]),
    ("Book a live visit", "/contact?topic=Classroom%20visit", "Teachers can request a live virtual visit for their class through the contact form.",
     ["live visit", "virtual visit", "bring my class", "class visit", "bring my students", "book", "schedule", "zoom", "video call", "field trip", "visit"]),
    ("Contact the IHH team", "/contact", "Questions, volunteering, partnerships, donations and press go through the contact form.",
     ["contact", "email", "reach", "volunteer", "partnership", "press", "donate", "donation", "help", "question"]),
    ("About the museum", "/about", "The Immigrant Hall of Honor documents, preserves and honors the ways immigrants have shaped the United States. A physical museum is planned for Central Texas.",
     ["about", "mission", "what is", "who are you", "ihh", "immigrant hall of honor", "texas", "building", "where is", "location", "hours", "open", "tickets"]),
    ("Sources", "/sources", "Every fact on the site is cited; the sources page lists each reference with its publisher and link.",
     ["source", "sources", "citation", "cited", "verify", "reference", "bibliography", "accurate", "true"]),
    ("Your account", "/account", "Register or sign in to keep the stories you share and your kids-mode passport together.",
     ["account", "sign in", "login", "log in", "register", "sign up", "password", "profile", "logout", "sign out"]),
    ("Integrate", "/integrate", "The data behind the museum is available as JSON, Markdown and HTML exports for the IHH website team.",
     ["api", "export", "json", "markdown", "integrate", "developer", "embed", "data"]),
]

GUIDE_INSTRUCTIONS = """You are the Museum Guide of the Immigrant Hall of Honor (IHH) virtual museum, a friendly, knowledgeable
concierge who talks with visitors, many of them students and teachers.

You are given (1) a SITE GUIDE describing the pages of this website and (2) zero or more INDUCTEE PROFILES made
of cited passages tagged like [S3].

Rules:
- Answer questions about inductees ONLY from the supplied profile passages. Cite the ids you relied on inline,
  e.g. "...in 1853 [S2]". If the passages do not contain the answer, say so and suggest the listed source or page.
  Never invent dates, quotes or facts. If no profile was supplied for a person, say the hall does not have a profile
  for them yet and offer the inductees who are here.
- Answer questions about the website from the SITE GUIDE. Point visitors to pages with Markdown links using the
  exact paths given, e.g. [Share a story](/share).
- Be warm, concise and conversational: 2 to 6 sentences, under 150 words, plain language for ages 12 and up.
- When comparing or listing several inductees, use a short bulleted list with a link to each profile, e.g.
  [Levi Strauss](/inductees/levi-strauss).
- Finish with a line "Sources used: S1, S4" only when you cited profile passages."""

STOP = {"what", "when", "where", "which", "about", "does", "did", "this", "that", "with", "from", "were", "have", "their", "they",
        "them", "why", "how", "who", "was", "the", "and", "for", "tell", "me", "you", "can", "please", "know", "more", "like", "there",
        "here", "are", "any", "some", "his", "her", "she", "him", "one", "all", "into", "your", "our", "get", "want", "would", "could"}


def _terms(text: str) -> set[str]:
    return {t for t in re.split(r"\W+", text.lower()) if len(t) > 2} - STOP


def _site_strength(question: str) -> int:
    q = question.lower()
    return max((sum(2 if " " in k else 1 for k in keys if k in q) for _, _, _, keys in SITE_PAGES), default=0)


def _site_matches(question: str) -> list[tuple[str, str, str]]:
    q = question.lower()
    scored = []
    for label, path, desc, keys in SITE_PAGES:
        score = sum(2 if " " in k else 1 for k in keys if k in q)
        if score:
            scored.append((score, label, path, desc))
    scored.sort(key=lambda x: -x[0])
    return [(l, p, d) for _, l, p, d in scored[:3]]


def _mentioned(repo: Repository, text: str) -> list[Inductee]:
    """Inductees named in the text (full name, surname or first name)."""
    low = text.lower()
    found = []
    for i in repo.all():
        parts = [p for p in re.split(r"[\s.]+", i.name.lower()) if len(p) > 2]
        if i.name.lower() in low or any(re.search(rf"\b{re.escape(p)}\b", low) for p in parts):
            found.append(i)
    return found


def _relevant(repo: Repository, messages: list[ChatMessage]) -> list[Inductee]:
    question = messages[-1].content
    picked: list[Inductee] = _mentioned(repo, question)
    if picked:
        return picked[:3]
    # Follow-up question ("when was he born?"): carry over whoever the conversation was already about.
    previous: list[Inductee] = []
    for m in reversed(messages[:-1]):
        previous = _mentioned(repo, m.content)
        if previous:
            break
    pronoun = re.search(r"\b(he|she|they|his|her|their|him|them|it)\b", question.lower())
    if previous and pronoun:
        return previous[:3]
    # A question about the website itself ("how do I bring my class?") should not drag in inductees whose
    # biographies happen to share a word; only strong site matches short-circuit the search.
    if _site_strength(question) >= 2:
        return []
    strong = {"name", "tagline", "field", "origin", "summary", "achievements", "honors"}
    hits = [h for h in repo.search(question, limit=3) if h.score >= 15 and strong & set(h.matched_in)]
    picked = [i for h in hits for i in [repo.get(h.slug)] if i]
    return (picked or previous)[:3]


def _wants_everyone(question: str) -> bool:
    q = question.lower()
    return any(k in q for k in ["who is in the hall", "who are the inductees", "list the inductees", "all the inductees", "which inductees",
                                "who is honored", "who is honoured", "everyone in", "how many inductees", "inductees are there"])


# --- offline fallback -------------------------------------------------------------
def _retrieve(i: Inductee, question: str, n: int = 2) -> list[tuple[str, list[str]]]:
    terms = _terms(question)
    scored = []
    for text, ids in _passages(i):
        low = text.lower()
        score = sum(low.count(t) for t in terms)
        if score:
            scored.append((score, text, ids))
    scored.sort(key=lambda x: -x[0])
    if not scored:  # nothing matched: lead with the summary passage
        return [_passages(i)[0]]
    return [(t, ids) for _, t, ids in scored[:n]]


def _fallback(repo: Repository, req: ChatRequest, people: list[Inductee], pages: list[tuple[str, str, str]]) -> ChatReply:
    question = req.messages[-1].content
    q = question.lower().strip()
    links: list[ChatLink] = []
    note = "The guide is in offline mode (no OpenAI API key configured), so answers are matching passages from the cited profiles."
    greeting = re.fullmatch(r"(hi|hello|hey|good (morning|afternoon|evening)|howdy)[!. ]*", q)
    if greeting:
        return ChatReply(answer="Hello, and welcome to the Immigrant Hall of Honor. Ask me about any inductee, or how to walk the hall, share your family's story, or bring a class for a visit.",
                         links=[ChatLink(label="Walk the museum", to="/museum"), ChatLink(label="Meet the inductees", to="/inductees")], note=note)
    if _wants_everyone(q):
        everyone = repo.all()
        lines = [f"• {i.name} — {i.tagline} (from {i.origin.country.split(' (')[0]}, arrived {i.immigration.year})" for i in everyone]
        return ChatReply(answer=f"The hall currently honors {len(everyone)} inductees:\n\n" + "\n".join(lines),
                         links=[ChatLink(label=i.name, to=f"/inductees/{i.slug}") for i in everyone], inductees=[i.slug for i in everyone], note=note)
    parts: list[str] = []
    cited: list[str] = []
    for i in people:
        passages = _retrieve(i, question)
        parts.append(f"About {i.name}:\n" + "\n".join(f"• {t} {''.join(f'[{s}]' for s in ids)}" for t, ids in passages))
        for _, ids in passages:
            for s in ids:
                if s not in cited:
                    cited.append(s)
        links.append(ChatLink(label=f"{i.name}'s exhibit", to=f"/inductees/{i.slug}"))
    for label, path, desc in pages:
        parts.append(f"{desc}")
        links.append(ChatLink(label=label, to=path))
    if not parts:
        return ChatReply(answer="I couldn't match that to an inductee or a page. Try asking about a person by name, for example \"Why did I. M. Pei come to the United States?\", or ask how to share a story or book a classroom visit.",
                         links=[ChatLink(label="Meet the inductees", to="/inductees"), ChatLink(label="Share a story", to="/share")], note=note)
    return ChatReply(answer="\n\n".join(parts), links=links, inductees=[i.slug for i in people], cited_source_ids=cited, note=note)


# --- OpenAI -------------------------------------------------------------------------
def _site_block() -> str:
    return "SITE GUIDE\n" + "\n".join(f"- {label} [{path}]: {desc}" for label, path, desc, _ in SITE_PAGES)


def reply(repo: Repository, req: ChatRequest) -> ChatReply:
    people = _relevant(repo, req.messages)
    pages = _site_matches(req.messages[-1].content)
    settings = get_settings()
    if not settings.docent_enabled or not _has_credentials():
        return _fallback(repo, req, people, pages)
    import openai

    roster = "INDUCTEES IN THE HALL\n" + "\n".join(f"- {i.name} [/inductees/{i.slug}]: {i.tagline}; from {i.origin.country}; arrived {i.immigration.year}" for i in repo.all())
    context = [_site_block(), roster] + [_context_block(i) for i in people]
    if req.page:
        context.append(f"The visitor is currently on the page {req.page}.")
    history = [{"role": m.role, "content": m.content} for m in req.messages[-10:]]
    try:
        response = _client().responses.create(
            model=settings.docent_model, instructions=GUIDE_INSTRUCTIONS,
            input=[{"role": "developer", "content": "\n\n".join(context)}, *history], max_output_tokens=500,
        )
    except (openai.AuthenticationError, openai.RateLimitError, openai.APIStatusError, openai.APIConnectionError) as exc:
        log.warning("Museum guide falling back to retrieval: %s", exc)
        out = _fallback(repo, req, people, pages)
        out.note = "The AI guide is unavailable right now; showing matching passages from the cited profiles instead."
        return out
    text = (response.output_text or "").strip()
    if not text:
        return _fallback(repo, req, people, pages)
    known = {s.id for i in people for s in i.sources}
    cited = []
    for sid in re.findall(r"\bS\d+\b", text):
        if sid in known and sid not in cited:
            cited.append(sid)
    links = [ChatLink(label=f"{i.name}'s exhibit", to=f"/inductees/{i.slug}") for i in people] + [ChatLink(label=l, to=p) for l, p, _ in pages]
    return ChatReply(answer=text, links=links, inductees=[i.slug for i in people], cited_source_ids=cited, model=response.model)


def _client():
    from openai import OpenAI
    return OpenAI()
