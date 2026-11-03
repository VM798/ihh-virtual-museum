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


def to_markdown(i: Inductee) -> str:
    idx = _source_index(i)
    lines: list[str] = [f"# {i.name}", "", f"*{i.tagline}*", ""]
    lines += [
        f"- **Birth name:** {i.birth_name}",
        f"- **Born:** {i.born.date or i.born.year}, {i.born.place}",
    ]
    if i.died:
        lines.append(f"- **Died:** {i.died.date or i.died.year}, {i.died.place}")
    lines += [
        f"- **Origin:** {i.origin.place}, {i.origin.country}",
        f"- **Immigrated:** {i.immigration.year}, {i.immigration.arrived} {_cite(i.immigration.source_ids, idx)}",
    ]
    if i.citizenship_year:
        lines.append(f"- **U.S. citizen:** {i.citizenship_year}")
    lines += ["", "## Biography", ""]
    for p in i.biography:
        lines += [f"{p.text} {_cite(p.source_ids, idx)}".rstrip(), ""]
    lines += ["## Achievements", ""]
    for a in i.achievements:
        year = f" ({a.year})" if a.year else ""
        lines.append(f"- **{a.title}**{year} — {a.description} {_cite(a.source_ids, idx)}".rstrip())
    lines += ["", "## Honors", ""]
    for h in i.honors:
        year = f" ({h.year})" if h.year else ""
        lines.append(f"- {h.title}{year} {_cite(h.source_ids, idx)}".rstrip())
    lines += ["", "## Timeline", ""]
    for e in i.timeline:
        lines.append(f"- **{e.date or e.year}** — {e.title}: {e.description} {_cite(e.source_ids, idx)}".rstrip())
    if i.quotes:
        lines += ["", "## In their words", ""]
        for q in i.quotes:
            lines += [f"> {q.text}", f"> — {q.context} {_cite([q.source_id], idx)}", ""]
    if i.media:
        lines += ["## Media resources", ""]
        for m in i.media:
            lines.append(f"- [{m.title}]({m.url}) — {m.kind}, {m.license}. Credit: {m.credit}.")
            if m.rights_note:
                lines.append(f"  - Rights note: {m.rights_note}")
    lines += ["", "## Sources", ""]
    for n, s in enumerate(i.sources, start=1):
        status = s.verification.status
        lines.append(f"{n}. {s.title} — {s.publisher}. <{s.url}> (link check: {status})")
    return "\n".join(lines) + "\n"


def to_html(i: Inductee) -> str:
    idx = _source_index(i)
    e = html.escape

    def sup(ids: list[str]) -> str:
        refs = [f'<a href="#ihh-src-{i.slug}-{idx[s]}" style="color:#0d5ab6;text-decoration:none">[{idx[s]}]</a>' for s in ids if s in idx]
        return f'<sup style="font-size:.7em">{"".join(refs)}</sup>' if refs else ""

    parts: list[str] = []
    parts.append(f'<section class="ihh-profile" style="font-family:Montserrat,sans-serif;font-size:16px;max-width:860px;margin:0 auto;color:#1a202c;line-height:1.6">')
    parts.append(
        f'<header style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;border-bottom:4px solid #ed1b24;padding-bottom:20px">'
        f'<img src="{e(i.hero_image.thumbnail)}" alt="{e(i.name)}" style="width:180px;height:180px;object-fit:cover;border-radius:12px">'
        f'<div style="flex:1;min-width:240px"><p style="margin:0;text-transform:uppercase;letter-spacing:.12em;font-size:13px;letter-spacing:3px;color:#d60810;font-weight:600">{e(i.field)}</p>'
        f'<h2 style="margin:4px 0 8px;font-size:48px;font-weight:700;line-height:1.1;letter-spacing:.04em;color:#0d5ab6;text-transform:uppercase">{e(i.name)}</h2><p style="margin:0 0 12px;font-style:italic;color:#2b6cb0">{e(i.tagline)}</p>'
        f'<dl style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:16px;line-height:1.6;margin:0">'
        f'<dt>Born</dt><dd style="margin:0">{e(i.born.date or str(i.born.year))}, {e(i.born.place)}</dd>'
        + (f'<dt>Died</dt><dd style="margin:0">{e(i.died.date or str(i.died.year))}, {e(i.died.place)}</dd>' if i.died else "")
        + f'<dt>Immigrated</dt><dd style="margin:0">{i.immigration.year}, {e(i.immigration.arrived)} {sup(i.immigration.source_ids)}</dd>'
        + (f'<dt>Citizen</dt><dd style="margin:0">{i.citizenship_year}</dd>' if i.citizenship_year else "")
        + '</dl></div></header>'
    )
    parts.append(f'<p style="font-size:14.4px;color:#718096">Portrait: {e(i.hero_image.credit)} — {e(i.hero_image.license)}.</p>')
    parts.append("<h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>Biography</h3>")
    for p in i.biography:
        parts.append(f"<p>{e(p.text)} {sup(p.source_ids)}</p>")
    parts.append("<h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>Achievements</h3><ul>")
    for a in i.achievements:
        year = f" ({e(a.year)})" if a.year else ""
        parts.append(f"<li><strong>{e(a.title)}</strong>{year} — {e(a.description)} {sup(a.source_ids)}</li>")
    parts.append("</ul><h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>Honors</h3><ul>")
    for h in i.honors:
        year = f" ({h.year})" if h.year else ""
        parts.append(f"<li>{e(h.title)}{year} {sup(h.source_ids)}</li>")
    parts.append("</ul><h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>Timeline</h3><ol style='border-left:3px solid #0d5ab6;padding-left:20px;list-style:none'>")
    for ev in i.timeline:
        parts.append(f"<li style='margin-bottom:10px'><strong style='color:#0d5ab6'>{e(ev.date or str(ev.year))}</strong> — <strong>{e(ev.title)}</strong>: {e(ev.description)} {sup(ev.source_ids)}</li>")
    parts.append("</ol>")
    if i.quotes:
        parts.append("<h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>In their words</h3>")
        for q in i.quotes:
            parts.append(f"<blockquote style='border-left:4px solid #ed1b24;margin:0 0 12px;padding:8px 16px;background:#f3f9ff'>“{e(q.text)}”<br><small>— {e(q.context)} {sup([q.source_id])}</small></blockquote>")
    if i.media:
        parts.append("<h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>Media resources</h3><ul>")
        for m in i.media:
            note = f" <em>Rights note: {e(m.rights_note)}</em>" if m.rights_note else ""
            parts.append(f"<li><a href='{e(m.url)}' rel='noopener'>{e(m.title)}</a> ({m.kind}, {e(m.license)}; credit: {e(m.credit)}).{note}</li>")
        parts.append("</ul>")
    parts.append("<h3 style='font-size:30px;font-weight:600;line-height:1.5;color:#0d5ab6;margin:28px 0 10px'>Sources</h3><ol style='font-size:14.4px'>")
    for n, s in enumerate(i.sources, start=1):
        parts.append(f"<li id='ihh-src-{i.slug}-{n}'>{e(s.title)} — {e(s.publisher)}. <a href='{e(s.url)}' rel='noopener'>{e(s.url)}</a> <span style='color:#777'>(link check: {s.verification.status})</span></li>")
    parts.append("</ol></section>")
    return "\n".join(parts)
