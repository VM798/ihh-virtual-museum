"""Illustrate every timeline moment with a dated, openly licensed picture.

Reads data/scene_queries.json, which names one picture source per moment:
  {"slug": "john-muir", "year": 1868, "title": "First sight", "q": "Yosemite Valley Carleton Watkins 1865"}
  {"slug": "john-muir", "year": 1903, "title": "Camping", "media": "Glacier Point"}   # reuse the profile's own media
  {"slug": "...", "year": ..., "title": "...", "file": "File:Exact_name.jpg"}         # a specific Commons file

For "q" the script searches Wikimedia Commons (bitmap files only), keeps the first result that is a
photograph-sized JPEG/PNG under a public-domain or Creative Commons licence, and records the file URL,
an 900px thumbnail, title, artist credit, licence, source page and the picture's own year. Results are
written to data/scenes.json (merged into each timeline event as "image" when the API loads). A review sheet (scenes_review.md) and a
contact sheet (scenes_review.jpg) are written to data/ so a person can check every match.

Usage:
  python scripts/find_scenes.py            # fill in moments that have no image yet
  python scripts/find_scenes.py --redo     # re-run every query
  python scripts/find_scenes.py --only john-muir --sheet
"""
from __future__ import annotations

import argparse
import html
import io
import json
import re
import sys
import time
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parent.parent / "data"
API = "https://commons.wikimedia.org/w/api.php"
UA = "IHH-virtual-museum/1.0 (Challenge X prototype for the Immigrant Hall of Honor; https://immigranthallofhonor.org)"
OK_LICENSE = ("public domain", "cc0", "cc by", "no restrictions", "attribution", "pdm")
SKIP_WORDS = ("map", "karte", "coat of arms", "wappen", "flag", "logo", "seal", "stamp", "diagram", "plan ", "chart", "poster", ".svg", "hitler", "banknote", "koruna", "coin", "catalogue", "sessional", "site plan", "plate ", "dandelion", "rolls", "boh&mor", "protectorate", "plaque", "georgette", "dr. martens")
TAGS = re.compile(r"<[^>]+>")


def clean(s: str | None) -> str:
    return html.unescape(TAGS.sub("", s or "")).strip()


def year_of(s: str | None) -> int | None:
    m = re.search(r"\b(1[5-9]\d\d|20\d\d)\b", s or "")
    return int(m.group(1)) if m else None


def acceptable(page: dict, min_year: int | None = None, max_year: int | None = None, min_width: int = 500) -> tuple[bool, str]:
    ii = page["imageinfo"][0]
    em = ii.get("extmetadata", {})
    lic = em.get("LicenseShortName", {}).get("value", "")
    title = page["title"].lower()
    taken = year_of(em.get("DateTimeOriginal", {}).get("value")) or year_of(page["title"])
    if taken and max_year and taken > max_year:
        return False, f"taken {taken}, after {max_year}"
    if taken and min_year and taken < min_year:
        return False, f"taken {taken}, before {min_year}"
    if not taken and (min_year or max_year) and not any(w in title for w in ("lccn", "nara", "bain", "detroit publishing", "postcard", "postkarte")):
        return False, "undated, era required"
    if ii.get("mime") not in ("image/jpeg", "image/png", "image/tiff"):
        return False, "not a photo format"
    if ii.get("width", 0) < min_width or ii.get("height", 0) < min_width * 0.7:
        return False, "too small"
    if not lic or not lic.lower().startswith(OK_LICENSE):
        return False, f"licence {lic or 'unknown'}"
    if any(w in title for w in SKIP_WORDS):
        return False, "looks like a map/flag/diagram"
    return True, ""


def to_image(page: dict) -> dict:
    ii = page["imageinfo"][0]
    em = ii.get("extmetadata", {})
    name = clean(em.get("ObjectName", {}).get("value")) or re.sub(r"^File:|\.[a-z]+$", "", page["title"], flags=re.I).replace("_", " ")
    artist = clean(em.get("Artist", {}).get("value")) or clean(em.get("Credit", {}).get("value")) or "Unknown"
    lic = em.get("LicenseShortName", {}).get("value", "")
    return {
        "url": ii["url"],
        "thumbnail": ii.get("thumburl", ii["url"]),
        "title": name[:140],
        "credit": f"{artist[:80]} · via Wikimedia Commons",
        "license": lic,
        "source_url": ii["descriptionurl"],
        "year": year_of(em.get("DateTimeOriginal", {}).get("value")) or year_of(name),
        "commons_file": page["title"],
    }


class Commons:
    def __init__(self) -> None:
        self.http = httpx.Client(headers={"User-Agent": UA}, timeout=30)

    def _pages(self, params: dict) -> list[dict]:
        r = self.http.get(API, params={"action": "query", "format": "json", "prop": "imageinfo",
                                       "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 900, **params})
        r.raise_for_status()
        pages = list(r.json().get("query", {}).get("pages", {}).values())
        pages = [p for p in pages if "imageinfo" in p]
        return sorted(pages, key=lambda p: p.get("index", 0))

    def search(self, q: str, limit: int = 10) -> list[dict]:
        return self._pages({"generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": limit})

    def file(self, title: str) -> list[dict]:
        return self._pages({"titles": title})


def load_inductees() -> dict[str, tuple[Path, dict]]:
    out = {}
    for path in sorted((DATA / "inductees").glob("*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))
        out[d["slug"]] = (path, d)
    return out


def find_event(d: dict, year: int, title: str) -> dict | None:
    hits = [e for e in d["timeline"] if e["year"] == year and e["title"].lower().startswith(title.lower())]
    return hits[0] if hits else None


def media_image(d: dict, needle: str) -> dict | None:
    for m in d["media"]:
        if needle.lower() in m["title"].lower() and (m.get("thumbnail") or m["kind"] == "image"):
            return {
                "url": m["url"], "thumbnail": m.get("thumbnail") or m["url"], "title": m["title"],
                "credit": m["credit"], "license": m["license"], "source_url": m["url"], "year": year_of(m.get("year")),
                "commons_file": None,
            }
    return None


def contact_sheet(rows: list[dict], out: Path, http: httpx.Client, offset: int = 0) -> None:
    from PIL import Image, ImageDraw

    cols, cw, ch, pad = 4, 320, 270, 6
    n = len(rows)
    sheet = Image.new("RGB", (cols * (cw + pad) + pad, ((n + cols - 1) // cols) * (ch + pad) + pad), "white")
    draw = ImageDraw.Draw(sheet)
    for j, row in enumerate(rows):
        i = offset + j
        x, y = pad + (j % cols) * (cw + pad), pad + (j // cols) * (ch + pad)
        img = row.get("image")
        if img and img.get("thumbnail"):
            try:
                src = img["thumbnail"].split("?")[0]
                resp = http.get(src, follow_redirects=True)
                if resp.status_code != 200:
                    time.sleep(2); resp = http.get(src, follow_redirects=True)
                im = Image.open(io.BytesIO(resp.content)).convert("RGB")
                time.sleep(0.4)
                im.thumbnail((cw, ch - 34))
                sheet.paste(im, (x, y))
            except Exception as ex:  # noqa: BLE001
                draw.text((x + 4, y + 4), f"load failed: {ex}"[:34], fill="red")
        else:
            draw.text((x + 4, y + 4), "NO IMAGE", fill="red")
        label = f"{i + 1}. {row['slug'].split('-')[-1]} {row['year']} {row['title'][:22]}"
        draw.rectangle((x, y + ch - 32, x + cw, y + ch), fill="black")
        draw.text((x + 3, y + ch - 30), label[:40], fill="white")
        draw.text((x + 3, y + ch - 16), ((img or {}).get("commons_file") or "profile media")[5:45], fill="#ffd133")
    sheet.save(out, quality=82)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--redo", action="store_true", help="re-run queries even where an image exists")
    ap.add_argument("--only", help="limit to one inductee slug")
    ap.add_argument("--sheet", action="store_true", help="write the contact sheet (downloads ~110 thumbnails)")
    args = ap.parse_args()

    queries = json.loads((DATA / "scene_queries.json").read_text(encoding="utf-8"))
    inductees = load_inductees()
    scenes_path = DATA / "scenes.json"
    scenes: dict[str, list[dict]] = json.loads(scenes_path.read_text(encoding="utf-8")).get("scenes", {}) if scenes_path.exists() else {}
    existing = {(slug, sc["year"], sc["title"]): sc["image"] for slug, lst in scenes.items() for sc in lst}
    commons = Commons()
    rows, changed = [], set()
    for q in queries:
        if args.only and q["slug"] != args.only:
            continue
        path, d = inductees[q["slug"]]
        ev = find_event(d, q["year"], q["title"])
        if not ev:
            print(f"!! no event for {q['slug']} {q['year']} {q['title']!r}", file=sys.stderr)
            continue
        key = (q["slug"], q["year"], q["title"])
        row = {"slug": q["slug"], "year": q["year"], "title": ev["title"], "query": q, "image": existing.get(key), "note": ""}
        rows.append(row)
        if existing.get(key) and not args.redo:
            continue
        image, note = None, ""
        if "media" in q:
            image = media_image(d, q["media"])
            note = "" if image else f"no media titled like {q['media']!r}"
        else:
            terms = [q["file"]] if "file" in q else (q["q"] if isinstance(q["q"], list) else [q["q"]])
            rejected = []
            for term in terms:
                pages = commons.file(term) if "file" in q else commons.search(term)
                for p in pages:
                    ok, why = acceptable(p, q.get("min_year"), q.get("max_year"), q.get("min_width", 500))
                    if ok:
                        image = to_image(p)
                        break
                    rejected.append(f"{p['title'][:60]}: {why}")
                time.sleep(0.2)
                if image:
                    break
            note = "" if image else ("no acceptable result; " + "; ".join(rejected[:4]) if rejected else "search returned nothing")
        if image:
            existing[key] = image
            row["image"] = image
            changed.add(q["slug"])
            print(f"ok  {q['slug']:<18} {q['year']} {ev['title'][:34]:<34} <- {image.get('commons_file') or 'media: ' + image['title'][:40]}")
        else:
            row["note"] = note
            if key in existing:  # a redo that found nothing drops the stale picture
                del existing[key]; row["image"] = None; changed.add(q["slug"])
            print(f"--  {q['slug']:<18} {q['year']} {ev['title'][:34]:<34} {note[:90]}", file=sys.stderr)

    if changed or not scenes_path.exists():
        out: dict[str, list[dict]] = {}
        for (slug, year, title), image in existing.items():
            out.setdefault(slug, []).append({"year": year, "title": title, "image": image})
        scenes_path.write_text(json.dumps({"generated_by": "scripts/find_scenes.py", "scenes": out}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    report = ["# Scene images for the timeline", "", "| # | Inductee | Year | Moment | Picture | Licence | Note |", "|---|---|---|---|---|---|---|"]
    for i, r in enumerate(rows, 1):
        img = r.get("image") or {}
        link = f"[{(img.get('commons_file') or img.get('title') or '')[:50]}]({img.get('source_url', '')})" if img else "—"
        report.append(f"| {i} | {r['slug']} | {r['year']} | {r['title'][:40]} | {link} | {img.get('license', '')} | {r['note'][:80]} |")
    (DATA / "scenes_review.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    if args.sheet:
        per = 24
        for k in range(0, len(rows), per):
            contact_sheet(rows[k:k + per], DATA / f"scenes_review_{k // per + 1}.jpg", commons.http, offset=k)
        print(f"contact sheets: {DATA}/scenes_review_N.jpg")
    missing = [r for r in rows if not r.get("image")]
    print(f"\n{len(rows) - len(missing)}/{len(rows)} moments illustrated; {len(missing)} missing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
