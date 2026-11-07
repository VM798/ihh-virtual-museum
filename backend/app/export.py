"""Render an inductee profile as Markdown or a self-contained HTML block.

The HTML output is designed to be pasted into a WordPress "Custom HTML" block
on immigranthallofhonor.org: it uses inline styles only, no scripts, and every
claim keeps its footnote-style citation.
"""
from __future__ import annotations

import html

from .models import Inductee


def _cite(ids: list[str], index: dict[str, int]) -> str:
    return "".join(f"[{index[i]}]" for i in ids if i in index)


def _source_index(i: Inductee) -> dict[str, int]:
    return {s.id: n for n, s in enumerate(i.sources, start=1)}


ROOMS = ["Arrival", "The personal story", "Work", "Artifacts and documents", "Historical context", "Legacy", "Explore further"]
EXPLORE_FURTHER = [
    ("Angel Island Immigration Museum: virtual exhibition", "https://www.aiisf.org/"),
    ("California Migration Museum", "https://www.calmigration.org/"),
    ("Immigration History Research Center: immigrant stories", "https://cla.umn.edu/ihrc"),
    ("Immigration Museum, Melbourne (Museums Victoria)", "https://museumsvictoria.com.au/immigrationmuseum/"),
]


def to_markdown(i: Inductee) -> str:
    """The profile as a seven-room exhibition, for editors who want to rework the text while keeping its footnotes."""
    from .narration import build_script

    idx = _source_index(i)
    surname = i.name.split()[-1]
    lines: list[str] = [f"# {i.name}", "", f"*{i.tagline}*", ""]
    lines += [
        f"- **Birth name:** {i.birth_name}",
        f"- **Born:** {i.born.date or i.born.year}, {i.born.place}",
    ]
    if i.died:
        lines.append(f"- **Died:** {i.died.date or i.died.year}, {i.died.place}")
    lines += [
        f"- **Origin:** {i.origin.place}, {i.origin.country}",
        f"- **Immigrated:** {i.immigration.year}, {i.immigration.arrived} {_cite(i.immigration.source_ids, idx)}".rstrip(),
    ]
    if i.citizenship_year:
        lines.append(f"- **U.S. citizen:** {i.citizenship_year}")
    lines += ["", f"_Portrait: {i.hero_image.credit}, {i.hero_image.license}._", ""]

    lines += [f"## Room 1 · How {surname} came to America", "", f"{i.immigration.detail} {_cite(i.immigration.source_ids, idx)}".rstrip(), "",
              f"- Born {i.born.year}, {i.born.place.split(',')[0]}", f"- Arrived {i.immigration.year}, aged {i.immigration.year - i.born.year}",
              f"- U.S. citizen: {i.citizenship_year or 'not confirmed'}", ""]

    lines += ["## Room 2 · The personal story", ""]
    for p in i.biography:
        lines += [f"{p.text} {_cite(p.source_ids, idx)}".rstrip(), ""]
    if i.quotes:
        lines += ["### In their words", ""]
        for q in i.quotes:
            lines += [f"> {q.text}", f"> — {q.context} {_cite([q.source_id], idx)}", ""]
    lines += ["### Key moments", ""]
    for ev in i.timeline:
        pic = f" ![{ev.image.title}]({ev.image.thumbnail or ev.image.url})" if ev.image else ""
        lines.append(f"- **{ev.date or ev.year}** — {ev.title}: {ev.description} {_cite(ev.source_ids, idx)}".rstrip())
        if ev.image:
            lines.append(f"  - Picture: [{ev.image.title}]({ev.image.source_url}) — {ev.image.credit}, {ev.image.license}")
    lines += ["", "## Room 3 · Work: what they gave their new country", ""]
    for a in i.achievements:
        year = f" ({a.year})" if a.year else ""
        lines.append(f"- **{a.title}**{year} — {a.description} {_cite(a.source_ids, idx)}".rstrip())
    lines += ["", "### Honors", ""]
    for h in i.honors:
        year = f" ({h.year})" if h.year else ""
        lines.append(f"- {h.title}{year} {_cite(h.source_ids, idx)}".rstrip())

    lines += ["", "## Room 4 · Artifacts and documents", ""]
    for m in i.media:
        lines.append(f"- [{m.title}]({m.url}) — {m.kind}{', ' + m.year if m.year else ''}. {m.description} Credit: {m.credit}. Licence: {m.license}.")
        if m.annotation:
            lines.append(f"  - Label: {m.annotation}")
        if m.rights_note:
            lines.append(f"  - Rights note: {m.rights_note}")

    if i.historical_context:
        c = i.historical_context
        lines += ["", f"## Room 5 · Historical context: {c.title} ({c.span})", "", c.text, "", "Further reading:"]
        lines += [f"- [{s.title}]({s.url}) — {s.publisher}" for s in c.sources]

    lines += ["", "## Room 6 · Legacy", ""]
    for ev in [e for e in i.timeline if e.category in ("legacy", "honor")]:
        lines.append(f"- **{ev.year}** — {ev.title}: {ev.description} {_cite(ev.source_ids, idx)}".rstrip())
    if i.fun_facts:
        lines += ["", "### Did you know?", ""] + [f"- {f.text} {_cite(f.source_ids, idx)}".rstrip() for f in i.fun_facts]
    if i.discussion_prompts:
        lines += ["", "### Talk about it (for classrooms)", ""] + [f"{n}. {p}" for n, p in enumerate(i.discussion_prompts, start=1)]

    n = build_script(i)
    lines += ["", "## Audio guide (script)", "", f"_About {n.seconds} seconds. Built only from the cited passages above (sources {', '.join(_cite([s], idx) for s in n.source_ids)})._", ""]
    lines += [n.text, ""]

    lines += ["## Room 7 · Explore further", "", "### Sources", ""]
    for k, s in enumerate(i.sources, start=1):
        status = s.verification.status
        lines.append(f"{k}. {s.title} — {s.publisher}. <{s.url}> (link check: {status})")
    lines += ["", "### Other museums of migration", ""] + [f"- [{t}]({u})" for t, u in EXPLORE_FURTHER]
    lines += ["", f"Share your own family's immigration story with the Immigrant Hall of Honor: https://immigranthallofhonor.org/tell-your-story/", ""]
    return "\n".join(lines) + "\n"


H3 = "<h3 style='font-size:26px;font-weight:600;line-height:1.4;color:#0d5ab6;margin:32px 0 10px'>"
ROOM = ("<h3 style='font-size:26px;font-weight:600;line-height:1.4;color:#0d5ab6;margin:36px 0 10px;padding-top:18px;border-top:1px solid #d8e3f1'>"
        "<span style='display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:{accent};color:#fff;font-size:18px;margin-right:10px'>{n}</span>{title}</h3>")


def to_html(i: Inductee) -> str:
    """A self-contained block (inline styles, no scripts) laid out as the seven-room exhibition, for a WordPress Custom HTML block."""
    from .narration import build_script

    idx = _source_index(i)
    e = html.escape
    surname = e(i.name.split()[-1])

    def sup(ids: list[str]) -> str:
        refs = [f'<a href="#ihh-src-{i.slug}-{idx[s]}" style="color:#0d5ab6;text-decoration:none">[{idx[s]}]</a>' for s in ids if s in idx]
        return f'<sup style="font-size:.7em">{"".join(refs)}</sup>' if refs else ""

    def room(n: int, title: str) -> str:
        return ROOM.format(accent=e(i.accent), n=n, title=e(title))

    parts: list[str] = []
    parts.append(f'<section class="ihh-profile" style="font-family:Montserrat,sans-serif;font-size:16px;max-width:860px;margin:0 auto;color:#1a202c;line-height:1.6">')
    parts.append(
        f'<header style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;border-bottom:4px solid {e(i.accent)};padding-bottom:20px">'
        f'<img src="{e(i.hero_image.thumbnail)}" alt="{e(i.name)}" style="width:180px;height:180px;object-fit:cover;border-radius:12px">'
        f'<div style="flex:1;min-width:240px"><p style="margin:0;text-transform:uppercase;font-size:13px;letter-spacing:3px;color:#d60810;font-weight:600">{e(i.field)} · {e(i.origin.flag)} {e(i.origin.country.split(" (")[0])} → United States</p>'
        f'<h2 style="margin:4px 0 8px;font-size:44px;font-weight:700;line-height:1.1;letter-spacing:.04em;color:#0d5ab6;text-transform:uppercase">{e(i.name)}</h2><p style="margin:0 0 12px;font-style:italic;color:#2b6cb0">{e(i.tagline)}</p>'
        f'<dl style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:16px;line-height:1.6;margin:0">'
        f'<dt>Born</dt><dd style="margin:0">{e(i.born.date or str(i.born.year))}, {e(i.born.place)}</dd>'
        + (f'<dt>Died</dt><dd style="margin:0">{e(i.died.date or str(i.died.year))}, {e(i.died.place)}</dd>' if i.died else "")
        + f'<dt>Immigrated</dt><dd style="margin:0">{i.immigration.year}, {e(i.immigration.arrived)} {sup(i.immigration.source_ids)}</dd>'
        + (f'<dt>Citizen</dt><dd style="margin:0">{i.citizenship_year}</dd>' if i.citizenship_year else "")
        + '</dl></div></header>'
    )
    parts.append(f'<p style="font-size:14px;color:#718096">Portrait: {e(i.hero_image.credit)} — {e(i.hero_image.license)}. '
                 f'This exhibit has seven rooms: {", ".join(e(r) for r in ROOMS)}.</p>')

    parts.append(room(1, f"How {i.name.split()[-1]} came to America"))
    parts.append(f"<p>{e(i.immigration.detail)} {sup(i.immigration.source_ids)}</p>")
    parts.append("<div style='display:flex;gap:12px;flex-wrap:wrap'>" + "".join(
        f"<div style='flex:1;min-width:140px;border:1px solid #d8e3f1;border-left:4px solid {e(i.accent)};border-radius:10px;padding:10px 14px'><div style='font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#718096'>{k}</div><div style='font-weight:700;color:{e(i.accent)};font-size:20px'>{v}</div></div>"
        for k, v in [("Born", f"{i.born.year}"), ("Arrived", f"{i.immigration.year}, aged {i.immigration.year - i.born.year}"), ("U.S. citizen", str(i.citizenship_year or "not confirmed"))]) + "</div>")

    parts.append(room(2, "The personal story"))
    for p in i.biography:
        parts.append(f"<p>{e(p.text)} {sup(p.source_ids)}</p>")
    for q in i.quotes:
        parts.append(f"<blockquote style='border-left:4px solid {e(i.accent)};margin:0 0 12px;padding:8px 16px;background:#f3f9ff'>“{e(q.text)}”<br><small>— {e(q.context)} {sup([q.source_id])}</small></blockquote>")
    parts.append(f"{H3}Key moments</h3><ol style='border-left:3px solid {e(i.accent)};padding-left:20px;list-style:none'>")
    for ev in i.timeline:
        pic = ""
        if ev.image:
            pic = (f"<figure style='margin:8px 0 0;display:flex;gap:12px;align-items:flex-start'>"
                   f"<img src='{e(ev.image.thumbnail or ev.image.url)}' alt='{e(ev.image.title)}' style='width:140px;height:96px;object-fit:cover;border-radius:8px;flex:none'>"
                   f"<figcaption style='font-size:13px;color:#718096'>{e(ev.image.title)}<br>{e(ev.image.credit)} · {e(ev.image.license)} · <a href='{e(ev.image.source_url)}' rel='noopener'>source</a></figcaption></figure>")
        parts.append(f"<li style='margin-bottom:14px'><strong style='color:{e(i.accent)}'>{e(ev.date or str(ev.year))}</strong> — <strong>{e(ev.title)}</strong>: {e(ev.description)} {sup(ev.source_ids)}{pic}</li>")
    parts.append("</ol>")

    parts.append(room(3, "Work: what they gave their new country") + "<ul>")
    for a in i.achievements:
        year = f" ({e(a.year)})" if a.year else ""
        parts.append(f"<li><strong>{e(a.title)}</strong>{year} — {e(a.description)} {sup(a.source_ids)}</li>")
    parts.append(f"</ul>{H3}Honors</h3><ul>")
    for h in i.honors:
        year = f" ({h.year})" if h.year else ""
        parts.append(f"<li>{e(h.title)}{year} {sup(h.source_ids)}</li>")
    parts.append("</ul>")

    parts.append(room(4, "Artifacts and documents") + "<ul>")
    for m in i.media:
        label = f"<br><em style='color:#4a5568'>Label: {e(m.annotation)}</em>" if m.annotation else ""
        note = f"<br><em>Rights note: {e(m.rights_note)}</em>" if m.rights_note else ""
        parts.append(f"<li style='margin-bottom:8px'><a href='{e(m.url)}' rel='noopener'>{e(m.title)}</a> ({m.kind}{', ' + e(m.year) if m.year else ''}; {e(m.license)}; credit: {e(m.credit)}). {e(m.description)}{label}{note}</li>")
    parts.append("</ul>")

    if i.historical_context:
        c = i.historical_context
        parts.append(room(5, f"Historical context: {c.title} ({c.span})"))
        parts.append(f"<p>{e(c.text)}</p><p style='font-size:14px'>Further reading: " + " · ".join(f"<a href='{e(s.url)}' rel='noopener'>{e(s.title)}</a> ({e(s.publisher)})" for s in c.sources) + "</p>")

    parts.append(room(6, "Legacy") + "<ul>")
    for ev in [x for x in i.timeline if x.category in ("legacy", "honor")]:
        parts.append(f"<li><strong>{ev.year}</strong> — {e(ev.title)}: {e(ev.description)} {sup(ev.source_ids)}</li>")
    parts.append("</ul>")
    if i.fun_facts:
        parts.append(f"{H3}Did you know?</h3><ul>" + "".join(f"<li>{e(f.text)} {sup(f.source_ids)}</li>" for f in i.fun_facts) + "</ul>")
    if i.discussion_prompts:
        parts.append(f"{H3}Talk about it (for classrooms)</h3><ol>" + "".join(f"<li>{e(p)}</li>" for p in i.discussion_prompts) + "</ol>")

    n = build_script(i)
    parts.append(f"{H3}Audio guide</h3><details style='border:1px solid #d8e3f1;border-radius:10px;padding:10px 14px'><summary style='cursor:pointer;font-weight:600'>Narration script (about {n.seconds} seconds)</summary>"
                 + "".join(f"<p>{e(p)}</p>" for p in n.paragraphs) + "</details>")

    parts.append(room(7, "Explore further") + f"{H3}Sources</h3><ol style='font-size:14px'>")
    for k, s in enumerate(i.sources, start=1):
        parts.append(f"<li id='ihh-src-{i.slug}-{k}'>{e(s.title)} — {e(s.publisher)}. <a href='{e(s.url)}' rel='noopener'>{e(s.url)}</a> <span style='color:#777'>(link check: {s.verification.status})</span></li>")
    parts.append(f"</ol>{H3}Other museums of migration</h3><ul>" + "".join(f"<li><a href='{e(u)}' rel='noopener'>{e(t)}</a></li>" for t, u in EXPLORE_FURTHER) + "</ul>")
    parts.append("<p style='border:2px solid #ed1b24;border-radius:12px;padding:14px 18px;margin-top:20px'><strong>Your family's journey belongs here too.</strong> "
                 "<a href='https://immigranthallofhonor.org/tell-your-story/' rel='noopener'>Tell your immigration story</a> to the Immigrant Hall of Honor.</p>")
    parts.append("</section>")
    return "\n".join(parts)


def to_lesson_markdown(i: Inductee) -> str:
    """A classroom packet: summary, key dates, primary sources, discussion prompts and activities."""
    idx = _source_index(i)
    lines: list[str] = [
        f"# Classroom packet: {i.name}", "",
        f"*{i.tagline}*", "",
        "Prepared from the IHH Virtual Museum profile. Every statement below is cited to a source listed at the end; "
        "teachers and students can follow the numbers to the evidence.", "",
        "## At a glance", "",
        f"- **Born:** {i.born.date or i.born.year}, {i.born.place}",
        f"- **Came to the United States:** {i.immigration.year}, {i.immigration.arrived} {_cite(i.immigration.source_ids, idx)}".rstrip(),
    ]
    if i.citizenship_year:
        lines.append(f"- **Became a U.S. citizen:** {i.citizenship_year}")
    if i.died:
        lines.append(f"- **Died:** {i.died.date or i.died.year}, {i.died.place}")
    lines += [f"- **Field:** {i.field}", "", "## The story in brief", "", i.summary, ""]
    if i.historical_context:
        c = i.historical_context
        lines += [f"## Historical context: {c.title} ({c.span})", "", c.text, "", "Further reading:"]
        lines += [f"- [{s.title}]({s.url}) — {s.publisher}" for s in c.sources]
        lines.append("")
    lines += ["## Key moments", ""]
    for ev in i.timeline:
        lines.append(f"- **{ev.date or ev.year}** — {ev.title}. {ev.description} {_cite(ev.source_ids, idx)}".rstrip())
    if i.quotes:
        lines += ["", "## In their own words", ""]
        for q in i.quotes:
            lines += [f"> {q.text}", f"> — {q.context} {_cite([q.source_id], idx)}", ""]
    lines += ["## Primary sources and artifacts to examine", ""]
    for m in i.media:
        lines.append(f"- **{m.title}** ({m.kind}{', ' + m.year if m.year else ''}) — {m.description} [{m.license}]({m.url})")
    lines += ["", "## Discussion prompts", ""]
    lines += [f"{n}. {p}" for n, p in enumerate(i.discussion_prompts, start=1)]
    lines += ["", "## Activities", "",
              f"1. **Timeline:** Place five of {i.name.split()[-1]}'s key moments on a class timeline beside events in U.S. immigration history from the context section.",
              "2. **Source detective:** Pick one primary source above. Who made it, when, and why? What does it prove, and what does it leave out?",
              f"3. **Your story:** Write or record a one-minute immigration story from your own family or community, then compare it with {i.name.split()[-1]}'s journey. Share it on the museum's *Share a Story* page.",
              "", "## Sources", ""]
    for n, s in enumerate(i.sources, start=1):
        lines.append(f"{n}. [{s.title}]({s.url}) — {s.publisher}")
    lines += ["", f"Full profile with media: {i.ihh_page_url}", ""]
    return "\n".join(lines)
