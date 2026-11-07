"""Generate the audio guide MP3 for each inductee with OpenAI text-to-speech.

The spoken script comes from app/narration.py, which builds it only from the profile's cited passages.
Files are written to data/audio/<slug>.mp3 and served by GET /api/inductees/<slug>/narration.mp3.

Run with the backend virtualenv so OPENAI_API_KEY in backend/.env is picked up:
    .venv/bin/python scripts/narrate.py            # all inductees, skipping existing files
    .venv/bin/python scripts/narrate.py --force    # regenerate everything
    .venv/bin/python scripts/narrate.py --only hedy-lamarr
    .venv/bin/python scripts/narrate.py --print    # show the scripts without calling the API
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.narration import audio_path, build_script  # noqa: E402
from app.repository import Repository  # noqa: E402

MODEL = "gpt-4o-mini-tts"
VOICE = "nova"
INSTRUCTIONS = ("You are a warm, engaging museum docent speaking to a small group that includes teenagers. Tell it like a story, "
                "not a report: conversational pacing, genuine curiosity, a lift of energy on surprising facts, a softer and slower voice "
                "for the hardest moments, and a clear pause between paragraphs. Pronounce names carefully. Never rush, never sound like a list.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--print", action="store_true", dest="show")
    args = ap.parse_args()

    repo = Repository(get_settings().data_dir)
    people = [i for i in repo.all() if not args.only or i.slug == args.only]
    if args.show:
        for i in people:
            n = build_script(i)
            print(f"=== {n.title} ({n.words} words, ~{n.seconds}s, sources {', '.join(n.source_ids)})\n{n.text}\n")
        return 0
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set (backend/.env). Nothing generated; the site will use browser read-aloud instead.", file=sys.stderr)
        return 1
    from openai import OpenAI
    client = OpenAI()
    for i in people:
        out = audio_path(i.slug)
        if out.exists() and not args.force:
            print(f"skip {i.slug} (exists)")
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        n = build_script(i)
        with client.audio.speech.with_streaming_response.create(model=MODEL, voice=VOICE, input=n.text, instructions=INSTRUCTIONS, response_format="mp3") as r:
            r.stream_to_file(out)
        print(f"ok   {i.slug}: {out.stat().st_size // 1024} KB, ~{n.seconds}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
