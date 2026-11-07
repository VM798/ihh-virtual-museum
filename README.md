# IHH Virtual Museum — Challenge X

A full-stack prototype answering the Immigrant Hall of Honor's **Challenge X**: engaging, interactive, *verifiable* profile
content for the current inductees, delivered in formats the IHH website team can drop straight into
[immigranthallofhonor.org](https://immigranthallofhonor.org).

| Layer | Stack |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, OpenAI SDK (AI docent), httpx (link checker) |
| Frontend | React 18, TypeScript, Vite, React Router, Framer Motion |
| Content | 10 inductee profiles as JSON (`backend/data/inductees/`), every claim cited to a source |

## What was delivered

- **10 inductee profiles** (the challenge asked for at least four): Albright, Berlin, Cruz, Einstein, Hope, Lamarr, Muir, Naismith, Pei, Strauss.
  Each has a cited biography, achievements, honours, a dated timeline, quotations, "did you know" facts, classroom discussion prompts,
  and an immigration "journey" panel.
- **Genuine, checked references.** 73 sources (Nobel Foundation, State Department Office of the Historian, Google Patents, NPS, Library of
  Congress, Pritzker Prize, university archives, Wikimedia Commons provenance pages …). `scripts/verify_sources.py` fetches every URL and
  records the result; the site shows a badge per source. Publishers that refuse automated requests are shown as "blocks bots" unless a
  person confirmed the page (recorded with date in `data/verification_overrides.json`).
- **Open-access multimedia**: 1911 Victor recordings of Irving Berlin, Bob Hope's first television special (1950), Hedy Lamarr's *Algiers*
  (1938), the Lamarr–Antheil patent case file, Naismith's typed 1891 rules and the only recording of his voice, Roosevelt and Muir at
  Glacier Point (1903), Einstein's 1940 citizenship photograph, Celia Cruz's Smithsonian stage dress … Every item states its licence
  and a rights note where a human check is still needed.
- **Editorial review notes**: statements on the current IHH pages that conflict with primary sources (e.g. Einstein's arrival year, Yosemite's
  founding year, the Pei East Building date), each with severity and citations.
- **AI docent** (OpenAI `gpt-5.4-mini`): answers visitor questions *only* from the profile's cited passages and returns source numbers.
  **AI label drafts** (`gpt-5.4`, with image input) write museum-label text for artifacts, marked for curator review. Without an API key the
  docent degrades to keyword retrieval over the same cited text.
- **Website-ready exports**: per-profile `export.html` (inline-styled block for a WordPress Custom HTML block), `export.md`, `export.json`,
  plus a documented REST API.

## Run it

```bash
# 1. backend
cd backend
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt   # or: python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # add OPENAI_API_KEY for the live AI docent (optional)
.venv/bin/uvicorn app.main:app --reload --port 8010

# 2. frontend (dev server proxies /api to :8000)
cd ../frontend
npm install
npm run dev                      # http://localhost:5173
```

Production: `npm run build` in `frontend/`, then start the backend alone — FastAPI serves `frontend/dist` and the API from one port
(`http://localhost:8010`, interactive API docs at `/docs`).

```bash
cd backend && .venv/bin/python -m pytest          # API + data integrity tests
cd backend && .venv/bin/python scripts/verify_sources.py --media   # re-check every source and media link
```

## Deploying to a public URL

The backend serves the built frontend, so one process hosts the whole site.

**Permanent link (Render, free tier).** Push the repository to GitHub, then on [render.com](https://render.com) choose *New → Blueprint* and pick the repository; `render.yaml` and the `Dockerfile` do the rest. The site appears at `https://ihh-virtual-museum.onrender.com` (or the name Render assigns). Optional: set `OPENAI_API_KEY` in the service's environment for live AI answers. The free plan sleeps when idle and does not keep visitor stories or accounts between deploys; add a persistent disk mounted at `/app/backend/data/community` before a public launch.

**Any Docker host.** `docker build -t ihh-museum . && docker run -p 8010:8010 ihh-museum`, then open port 8010.

**Temporary link from your own computer.** With the backend running (`uvicorn app.main:app --port 8010` after `npm run build`), install [cloudflared](https://github.com/cloudflare/cloudflared/releases) and run `cloudflared tunnel --url http://localhost:8010`. It prints a `https://….trycloudflare.com` address that works anywhere until you stop it.

## What was added after the first submission

- **Museum guide chatbot.** An "Ask the museum" button on every page opens a guide that answers about any inductee (from the cited profile passages, with source ids) and about the site itself (how to walk the hall, share a story, book a classroom visit, kids mode). It keeps the conversation in scope for follow-ups ("when was he born?"). Endpoint `POST /api/docent/chat`; uses OpenAI when a key is set, otherwise keyword retrieval over the same passages.
- **Museum interior and cursor navigation.** The 3D hall is dressed like a gallery: wainscoting, crown moulding, pilasters, brass picture lights with a spotlight on every portrait, coffered ceiling with skylights, red carpet runner, a display case beside each portrait, a welcome lobby and a "your story belongs here" wall. Navigate with the cursor alone: click the floor to walk there, click a picture from afar to glide up to it and open it, drag or rest the cursor at the edge to look around, two-finger scroll to move and turn, pinch (ctrl+wheel) or the +/− buttons to zoom, and jump to any inductee from the portrait strip. A location chip shows which bay you are standing in.
- **Visitor accounts.** Register, sign in and sign out from the top bar (`/register`, `/signin`, `/account`). Passwords are hashed with scrypt, sessions live in an HttpOnly cookie, and the server keeps only a digest of each session token. Stories shared while signed in are listed on the account page with their review status. Users and sessions are stored under `backend/data/community/` (gitignored). Set `IHH_SECURE_COOKIES=1` when serving over HTTPS.
- **Exhibition layout.** Each profile is laid out as seven rooms (arrival → story → work → artifacts → historical context → legacy → explore further), following the Challenge X suggestion of turning a profile into a small digital exhibition. The HTML and Markdown exports follow the same structure.
- **Historical context** (`backend/data/context.json`): five short, cited era summaries of U.S. immigration, matched to each inductee's year of arrival.
- **Scene pictures** for all 109 timeline moments (`backend/data/scenes.json`, generated by `scripts/find_scenes.py` from Wikimedia Commons with licence checks and a review sheet).
- **Audio guide** per inductee: a spoken introduction scripted only from cited passages (`app/narration.py`). `scripts/narrate.py` generates MP3s with OpenAI text-to-speech when a key is set; otherwise the site reads the script aloud with the browser.
- **Timeline** as a storybook: pick a face, scroll through illustrated moments, drag a marker along the life ruler.
- **Share a Story** (`/share`), **Educators** (`/educators`, classroom packets at `/api/inductees/{slug}/lesson.md`), **About** and **Contact** pages; visitor submissions are stored under `backend/data/community/` for review.
- **Inductees** page with an A–Z letter bar.

Frontend needs Node 18+ (`npm install` in `frontend/`). The backend runs on Python 3.12 or 3.13.

## Repository layout

```
backend/
  app/main.py            FastAPI app, CORS, static serving of the built frontend
  app/models.py          Pydantic schema; validates that every source_id resolves
  app/repository.py      loads data/inductees/*.json, search, global timeline, stats
  app/export.py          Markdown / HTML renderers (seven-room exhibition) and the classroom packet
  app/narration.py       audio-guide script built from cited passages
  app/routers/community.py  visitor stories and contact messages
  app/docent.py          OpenAI-powered docent + label drafting with offline fallback
  app/routers/           /api/inductees, /api/timeline, /api/sources, /api/stats, /api/docent
  data/inductees/*.json  the content (one file per inductee)
  data/verification.json link-check results merged into each source at startup
  scripts/verify_sources.py
  scripts/find_scenes.py   picks a licensed Commons picture for every timeline moment
  scripts/narrate.py       generates audio guides with OpenAI TTS
  tests/test_api.py
frontend/src/
  pages/    Home, Gallery, Profile, TimelinePage, SharePage, EducatorsPage, AboutPage, ContactPage, SourcesPage, IntegratePage
  components/  Nav (live search), InducteeCard, Journey (animated SVG), TimelineRail, MediaGallery (lightbox, audio, video), Docent, Citation, SourceBadge
```

## Editorial principles

1. Start from the existing IHH page, then deepen with primary and institutional sources.
2. Every paragraph, event and honour carries `source_ids`; the schema rejects a dangling citation.
3. Prefer public-domain and Creative Commons media; link (don't re-host) anything whose rights are uncertain and say why.
4. AI output is grounded in the cited text, always labelled, and never final copy.

## Branding

The colour scheme and typography follow immigranthallofhonor.org: white pages with pale-blue panels, IHH red (#ed1b24 / #d60810) for primary actions and labels, royal blue (#0d5ab6 / #2b6cb0) for bands, headings and links, yellow (#ffd133) as a highlight, and Montserrat throughout. Type sizes were measured from the live site with `getComputedStyle` on 2026-11-02: body 16px/1.6, large headings 48px/700 with 0.04em tracking, sub-headings 30px/600, label text 13px/600 with 3px tracking, nav 13px uppercase with 2px tracking, buttons 13px uppercase with 0.15em tracking, footer links 12px/600 with 2.4px tracking, small text 14.4px. The tokens live at the top of `frontend/src/styles.css`; the WordPress HTML export uses the same colours inline.

The header and footer use the Immigrant Hall of Honor's own logo and mark, downloaded from immigranthallofhonor.org on 2026-11-02 and stored in `frontend/public/ihh/` (see the README there for the source URLs). They are IHH's marks, not open-licensed media.

## Competition video

`video/` builds the five-minute presentation video (`video/out/IHH_Virtual_Museum_ChallengeX.mp4`, 1920x1080):

1. `tts.py` narrates `script.json` with OpenAI text-to-speech (`gpt-4o-mini-tts`).
2. `cards.js` renders the title, challenge and closing cards in headless Chromium.
3. `record.js` drives the running app in headless Chromium and records each segment at narration pace, including a live AI label draft and docent answer.
4. `music.js` synthesises a royalty-free ambient bed (no samples or downloads).
5. `build.js` assembles clips, burns captions from the narration, and mixes the music under the voice with side-chain ducking.

Run `./video/run.sh` with the app serving on port 8010. Node dependencies: `cd video && npm install && npx playwright install chromium`.
