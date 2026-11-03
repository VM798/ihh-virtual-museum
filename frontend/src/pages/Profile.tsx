import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import Cite from "../components/Citation";
import Docent from "../components/Docent";
import Journey from "../components/Journey";
import Loader, { ErrorBox } from "../components/Loader";
import MediaGallery from "../components/MediaGallery";
import Reveal from "../components/Reveal";
import SourceBadge from "../components/SourceBadge";
import TimelineRail from "../components/TimelineRail";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function Profile() {
  const { slug = "" } = useParams();
  const { data: i, error, loading } = useFetch(() => api.inductee(slug), [slug]);
  const { data: all } = useFetch(() => api.inductees(), []);
  const { data: docent } = useFetch(() => api.docentStatus(), []);
  if (error) return <ErrorBox message={error} />;
  if (loading || !i) return <Loader text="Opening the exhibit…" />;

  const idx = all ? all.findIndex((p) => p.slug === slug) : -1;
  const prev = all && idx > 0 ? all[idx - 1] : null;
  const next = all && idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const sections = [["story", "Story"], ["journey", "Journey"], ["timeline", "Timeline"], ["achievements", "Achievements"], ["media", "Media"], ["ask", "Ask"], ["review", "Editorial notes"], ["sources", "Sources"]];

  return (
    <>
      <section className="profile-hero">
        <div className="glow" style={{ background: i.accent, top: -120, left: -80 }} />
        <div className="container profile-grid">
          <motion.figure className="profile-portrait" style={{ margin: 0 }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }}>
            <img src={i.hero_image.url} alt={i.name} />
            <figcaption>{i.hero_image.credit} · <a href={i.hero_image.source_url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{i.hero_image.license}</a></figcaption>
          </motion.figure>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <span className="eyebrow" style={{ color: i.accent }}>{i.field} · {i.origin.flag} {i.origin.country.split(" (")[0]} → 🇺🇸 United States</span>
            <h1 style={{ margin: "10px 0 6px" }}>{i.name}</h1>
            <p className="muted small">born {i.birth_name}</p>
            <p className="serif" style={{ fontSize: "1.4375rem", fontWeight: 400, lineHeight: 1.5, color: "var(--blue)", fontStyle: "italic" }}>{i.tagline}</p>
            <p className="muted">{i.summary}</p>
            <div className="facts">
              <div className="fact"><div className="k">Born</div><div className="v">{i.born.date ?? i.born.year}</div><div className="faint" style={{ fontSize: "0.8125rem" }}>{i.born.place}</div></div>
              {i.died && <div className="fact"><div className="k">Died</div><div className="v">{i.died.date ?? i.died.year}</div><div className="faint" style={{ fontSize: "0.8125rem" }}>{i.died.place}</div></div>}
              <div className="fact"><div className="k">Arrived</div><div className="v">{i.immigration.year}</div><div className="faint" style={{ fontSize: "0.8125rem" }}>{i.immigration.arrived}</div></div>
              <div className="fact"><div className="k">U.S. citizen</div><div className="v">{i.citizenship_year ?? "see notes"}</div></div>
              <div className="fact"><div className="k">Occupation</div><div className="v" style={{ fontSize: "0.9rem" }}>{i.occupations.join(" · ")}</div></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              {i.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              <a className="btn btn-sm" href={api.exportUrl(i.slug, "html")}>⬇ HTML for the website</a>
              <a className="btn btn-sm" href={api.exportUrl(i.slug, "md")}>⬇ Markdown</a>
              <a className="btn btn-sm" href={i.ihh_page_url} target="_blank" rel="noreferrer">Current IHH page ↗</a>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="subnav"><div className="container subnav-inner">{sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</div></div>

      <section className="section" id="story">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">The story</span><h2>Biography</h2></div></div>
          <div className="prose">
            {i.biography.map((p, n) => (
              <Reveal key={n}><p className={n === 0 ? "lead-para" : ""}>{p.text}<Cite ids={p.source_ids} sources={i.sources} /></p></Reveal>
            ))}
          </div>
          {i.quotes.length > 0 && (
            <div className="grid cols-2" style={{ marginTop: 40 }}>
              {i.quotes.map((q, n) => (
                <Reveal key={n} delay={n * 0.1}>
                  <div className="card" style={{ borderColor: `${i.accent}66` }}>
                    <div className="quote">“{q.text}”</div>
                    <div className="quote-ctx">— {q.context}<Cite ids={[q.source_id]} sources={i.sources} /></div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="journey" style={{ paddingTop: 0 }}>
        <div className="container"><Reveal><Journey i={i} /></Reveal></div>
      </section>

      <section className="section" id="timeline" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Timeline</span><h2>{i.timeline.length} moments</h2></div></div>
          <div className="grid cols-2" style={{ alignItems: "start" }}>
            <TimelineRail events={i.timeline} sources={i.sources} />
            <div style={{ position: "sticky", top: 130 }}>
              {i.fun_facts.length > 0 && (
                <div className="card" style={{ marginBottom: 18 }}>
                  <span className="eyebrow">Did you know?</span>
                  {i.fun_facts.map((f, n) => <p key={n} style={{ margin: "10px 0 0" }}>{f.text}<Cite ids={f.source_ids} sources={i.sources} /></p>)}
                </div>
              )}
              {i.discussion_prompts.length > 0 && (
                <div className="card" style={{ background: `linear-gradient(160deg, ${i.accent}22, transparent)` }}>
                  <span className="eyebrow">Talk about it · for classrooms</span>
                  <ol style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--muted)", lineHeight: 1.7 }}>
                    {i.discussion_prompts.map((p, n) => <li key={n}>{p}</li>)}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="achievements" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Achievements & honours</span><h2>What they gave their new country</h2></div></div>
          <div className="grid cols-3">
            {i.achievements.map((a, n) => (
              <Reveal key={n} delay={n * 0.05}>
                <div className="card card-hover" style={{ height: "100%" }}>
                  <span className="eyebrow" style={{ color: i.accent }}>{a.year ?? "—"}</span>
                  <h3 style={{ fontSize: "1.125rem", margin: "6px 0 8px" }}>{a.title}</h3>
                  <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>{a.description}<Cite ids={a.source_ids} sources={i.sources} /></p>
                </div>
              </Reveal>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            {i.honors.map((h, n) => <span key={n} className="chip" style={{ cursor: "default" }}>🏅 {h.title}{h.year ? ` · ${h.year}` : ""}<Cite ids={h.source_ids} sources={i.sources} /></span>)}
          </div>
        </div>
      </section>

      <section className="section" id="media" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Media & artifacts</span><h2>See, hear, read</h2><p>Open-access photographs, recordings, films and documents, each with its licence and a link to the holding institution.</p></div></div>
          <MediaGallery media={i.media} slug={i.slug} aiLive={!!docent?.live} />
        </div>
      </section>

      <section className="section" id="ask-section" style={{ paddingTop: 0 }}>
        <div className="container"><Docent i={i} /></div>
      </section>

      {i.review_notes.length > 0 && (
        <section className="section" id="review" style={{ paddingTop: 0 }}>
          <div className="container">
            <details>
              <summary className="eyebrow" style={{ fontSize: "0.8125rem" }}>Editorial review notes for the IHH team ({i.review_notes.length})</summary>
              <p className="muted" style={{ margin: "10px 0 16px", fontSize: "0.9rem" }}>Statements on the current IHH page compared with the sources cited here.</p>
              <div className="grid cols-2">
                {i.review_notes.map((n, k) => (
                  <div className="note" key={k}>
                    <span className={`sev sev-${n.severity}`}>{n.severity}</span>
                    <div className="stmt" style={{ marginTop: 8 }}>Current page says: <em>“{n.ihh_statement}”</em></div>
                    <div style={{ marginTop: 6, fontSize: "0.9rem" }}>{n.finding}<Cite ids={n.source_ids} sources={i.sources} /></div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>
      )}

      <section className="section" id="sources" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Sources</span><h2>Check the evidence</h2></div><Link to="/sources" className="btn btn-sm">Full library →</Link></div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>#</th><th>Source</th><th>Publisher</th><th>Kind</th><th>Link check</th></tr></thead>
              <tbody>
                {i.sources.map((s, n) => (
                  <tr key={s.id} id={`src-${s.id}`}>
                    <td className="src-id">[{n + 1}] {s.id}</td>
                    <td><a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{s.title}</a>{s.note && <div className="faint" style={{ fontSize: "0.8125rem" }}>{s.note}</div>}</td>
                    <td>{s.publisher}</td>
                    <td><span className="tag">{s.kind}</span></td>
                    <td><SourceBadge v={s.verification} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 12, flexWrap: "wrap" }}>
            {prev ? <Link className="btn" to={`/inductees/${prev.slug}`}>← {prev.name}</Link> : <span />}
            {next ? <Link className="btn" to={`/inductees/${next.slug}`}>{next.name} →</Link> : <span />}
          </div>
        </div>
      </section>
    </>
  );
}
