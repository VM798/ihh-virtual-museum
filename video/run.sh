#!/usr/bin/env bash
# Builds the 5-minute competition video end to end.
# Requires: the app running at http://127.0.0.1:8010 (see README), node deps installed in this folder
# (npm install && npx playwright install chromium), and OPENAI_API_KEY in ../backend/.env.
set -euo pipefail
cd "$(dirname "$0")"
PY=../backend/.venv/bin/python

echo "1/5 narration (OpenAI TTS)"; $PY tts.py
echo "2/5 title cards";            node cards.js
echo "3/5 screen recording";       node record.js
echo "4/5 music bed";              node music.js 340
echo "5/5 assembly";               node build.js
