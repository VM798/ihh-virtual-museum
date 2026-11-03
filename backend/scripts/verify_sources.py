#!/usr/bin/env python
"""Check every source URL cited in the inductee profiles and record the result.

Usage:  python scripts/verify_sources.py [--media]

Writes data/verification.json, which the API merges into each source at startup so the
website can show when a link was last confirmed. The checker identifies itself honestly;
publishers that refuse automated requests are recorded as "blocked" (not as broken) and a
person can confirm them by hand in data/verification_overrides.json.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import sys
import time
from datetime import date
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = "IHHVirtualMuseumLinkChecker/1.0 (+https://immigranthallofhonor.org; citation link verification)"


def collect_urls(include_media: bool) -> dict[str, list[str]]:
    urls: dict[str, list[str]] = {}
    for path in sorted((DATA / "inductees").glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        for s in raw["sources"]:
            urls.setdefault(s["url"], []).append(f"{raw['slug']}:{s['id']}")
        if include_media:
            for m in raw.get("media", []):
                for key in ("url", "embed_url", "thumbnail"):
                    if m.get(key):
                        urls.setdefault(m[key], []).append(f"{raw['slug']}:media:{m['id']}:{key}")
            urls.setdefault(raw["hero_image"]["url"], []).append(f"{raw['slug']}:hero")
            urls.setdefault(raw["hero_image"]["thumbnail"], []).append(f"{raw['slug']}:hero:thumb")
    return urls


def check(url: str) -> dict:
    today = date.today().isoformat()
    try:
        with httpx.Client(follow_redirects=True, timeout=30, headers={"User-Agent": UA}) as client:
            r = client.get(url)
            if r.status_code == 429:  # rate limited: wait once and try again, same identity
                time.sleep(5)
                r = client.get(url)
        code = r.status_code
        status = "ok" if 200 <= code < 300 else ("blocked" if code in (401, 403, 429) else "error")
        note = None
        if r.url and str(r.url).rstrip("/") != url.rstrip("/"):
            note = f"redirected to {r.url}"
        return {"method": "http", "status": status, "http_status": code, "checked_at": today, "note": note}
    except httpx.HTTPError as exc:
        return {"method": "http", "status": "error", "http_status": None, "checked_at": today, "note": type(exc).__name__}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--media", action="store_true", help="also check media file and thumbnail URLs")
    args = parser.parse_args()

    urls = collect_urls(args.media)
    overrides_path = DATA / "verification_overrides.json"
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}

    results: dict[str, dict] = {}
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        for url, result in zip(urls, pool.map(check, urls)):
            results[url] = result
    for url, override in overrides.items():
        if url in results and results[url]["status"] != "ok":
            results[url] = {"method": "manual", "status": "ok", "http_status": results[url]["http_status"],
                            "checked_at": override["checked_at"], "note": override["note"]}

    out = {"generated": date.today().isoformat(), "results": results}
    (DATA / "verification.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    ok = sum(1 for r in results.values() if r["status"] == "ok")
    print(f"Checked {len(results)} URLs: {ok} ok")
    for url, r in results.items():
        if r["status"] != "ok":
            print(f"  {r['status']:8} {r['http_status']!s:5} {url}  <- {', '.join(urls[url])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
