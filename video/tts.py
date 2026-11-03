"""Generate narration audio for every segment in script.json with OpenAI text-to-speech.

Run with the backend virtualenv so the OpenAI key in backend/.env is picked up:
    ../backend/.venv/bin/python tts.py
Existing files are reused unless --force is passed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / "backend" / ".env")

MODEL = "gpt-4o-mini-tts"


def main() -> None:
    force = "--force" in sys.argv
    script = json.loads((HERE / "script.json").read_text())
    out_dir = HERE / "out" / "narration"
    out_dir.mkdir(parents=True, exist_ok=True)
    client = OpenAI()
    for seg in script["segments"]:
        target = out_dir / f"{seg['id']}.mp3"
        if target.exists() and not force:
            print("keep ", target.name)
            continue
        with client.audio.speech.with_streaming_response.create(
            model=MODEL,
            voice=script.get("voice", "nova"),
            input=seg["narration"],
            instructions=script.get("voice_instructions", ""),
            response_format="mp3",
        ) as response:
            response.stream_to_file(target)
        print("wrote", target.name, target.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
