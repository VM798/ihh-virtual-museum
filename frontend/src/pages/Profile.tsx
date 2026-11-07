import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import Cite from "../components/Citation";
import AudioGuide from "../components/AudioGuide";
import Docent from "../components/Docent";
import Journey from "../components/Journey";
import Loader, { ErrorBox } from "../components/Loader";
import MediaGallery from "../components/MediaGallery";
import Reveal from "../components/Reveal";
import SourceBadge from "../components/SourceBadge";
import TimelineRail from "../components/TimelineRail";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

/* Each profile is laid out as a small exhibition with seven rooms, following the framework suggested for Challenge X:
   arrival → personal story → work → artifacts & documents → historical context → legacy → further exploration. */
const ROOMS = [
  ["arrival", "Arrival"], ["story", "Story"], ["work", "Work"], ["artifacts", "Artifacts"],
  ["context", "Context"], ["legacy", "Legacy"], ["explore", "Explore"],
] as const;

function Room({ n, id, title, lead, children }: { n: number; id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="section room" id={id}>
      <div className="container">
        <div className="room-head">
          <span className="room-no">{n}</span>
          <div><span className="eyebrow">Room {n} of {ROOMS.length}</span><h2>{title}</h2>{lead && <p>{lead}</p>}</div>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function Profile() {
  const { slug = "" } = useParams();
  const { data: i, error, loading } = useFetch(() => api.inductee(slug), [slug]);
  const { data: all } = useFetch(() => api.inductees(), []);
  const { data: docent } = useFetch(() => api.docentStatus(), []);
  const { data: explore } = useFetch(() => api.explore(), []);
  if (error) return <ErrorBox message={error} />;
  if (loading || !i) return <Loader text="Opening the exhibit…" />;

  const idx = all ? all.findIndex((p) => p.slug === slug) : -1;
  const prev = all && idx > 0 ? all[idx - 1] : null;
  const next = all && idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const surname = i.name.split(" ").slice(-1)[0];
  const legacyEvents = i.timeline.filter((e) => e.category === "legacy" || e.category === "honor");
  const ctx = i.historical_context;

  return (
    <div className="profile" style={{ "--accent": i.accent } as CSSProperties}>
      <section className="profile-hero">
        <div className="glow" style={{ background: i.accent, top: -120, left: -80 }} />
        <div className="container profile-grid">
          <motion.figure className="profile-portrait" style={{ margin: 0 }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }}>
            <img src={i.hero_image.url} alt={i.name} />
            <figcaption>{i.hero_image.credit} · <a href={i.hero_image.source_url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{i.hero_image.license}</a></figcaption>
          </motion.figure>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>{i.field} · {i.origin.flag} {i.origin.country.split(" (")[0]} → 🇺🇸 United States</span>
            <h1 style={{ margin: "10px 0 6px" }}>{i.name}</h1>
            <p className="muted small">born {i.birth_name}</p>
            <p className="serif tagline" style={{ fontSize: "1.5rem", fontWeight: 500, lineHeight: 1.4, fontStyle: "italic" }}>{i.tagline}</p>
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
            <AudioGuide i={i} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              <a className="btn btn-sm" href={api.lessonUrl(i.slug)}>⬇ Classroom packet</a>
              <a className="btn btn-sm" href={api.exportUrl(i.slug, "html")}>⬇ HTML for the website</a>
              <a className="btn btn-sm" href={i.ihh_page_url} target="_blank" rel="noreferrer">Current IHH page ↗</a>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="subnav"><div className="container subnav-inner rooms-nav">{ROOMS.map(([id, label], n) => <a key={id} href={`#${id}`}><b>{n + 1}</b> {label}</a>)}</div></div>

      <Room n={1} id="arrival" title={`How ${surname} came to America`} lead={i.immigration.detail}>
        <Reveal><Journey i={i} /></Reveal>
      </Room>

      <Room n={2} id="story" title="The personal story">
        <div className="room-cols">
          <div className="prose">
            {i.biography.map((p, n) => (
              <Reveal key={n}><p className={n === 0 ? "lead-para" : ""}>{p.text}<Cite ids={p.source_ids} sources={i.sources} /></p></Reveal>
            ))}
            {i.quotes.length > 0 && (
              <div className="grid cols-2" style={{ marginTop: 32 }}>
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
          <aside className="room-side">
            <span className="eyebrow">{i.timeline.length} moments</span>
            <TimelineRail events={i.timeline} sources={i.sources} />
            <Link className="btn btn-sm" to={`/timeline?who=${i.slug}`}>Walk it on the timeline →</Link>
          </aside>
        </div>
      </Room>

      <Room n={3} id="work" title="What they gave their new country">
        <div className="grid cols-3">
          {i.achievements.map((a, n) => (
            <Reveal key={n} delay={n * 0.05}>
              <div className="card card-hover" style={{ height: "100%" }}>
                <span className="eyebrow" style={{ color: "var(--accent)" }}>{a.year ?? "—"}</span>
                <h3 style={{ fontSize: "1.125rem", margin: "6px 0 8px" }}>{a.title}</h3>
                <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>{a.description}<Cite ids={a.source_ids} sources={i.sources} /></p>
              </div>
            </Reveal>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          {i.honors.map((h, n) => <span key={n} className="chip" style={{ cursor: "default" }}>🏅 {h.title}{h.year ? ` · ${h.year}` : ""}<Cite ids={h.source_ids} sources={i.sources} /></span>)}
        </div>
      </Room>

      <Room n={4} id="artifacts" title="Artifacts and documents" lead="Open-access photographs, recordings, films and documents, each with its licence and a link to the holding institution. Ask the docent anything about them.">
        <MediaGallery media={i.media} slug={i.slug} aiLive={!!docent?.live} />
        <div style={{ marginTop: 28 }}><Docent i={i} /></div>
      </Room>

      <Room n={5} id="context" title={ctx ? ctx.title : "Historical context"} lead={ctx ? `U.S. immigration in ${ctx.span}, the years ${surname} arrived.` : undefined}>
        {ctx ? (
          <div className="room-cols">
            <div className="prose context-text"><p>{ctx.text}</p></div>
            <aside className="room-side">
              <span className="eyebrow">Read more</span>
              <ul className="context-sources">
                {ctx.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a><small>{s.publisher}</small></li>)}
              </ul>
              <Link className="btn btn-sm" to="/timeline">See all ten lives side by side →</Link>
            </aside>
          </div>
        ) : <p className="muted">Context for this era is still being written.</p>}
      </Room>

      <Room n={6} id="legacy" title="Legacy">
        <div className="room-cols">
          <div>
            {legacyEvents.length > 0 && (
              <div className="legacy-list">
                {legacyEvents.map((e, n) => (
                  <Reveal key={n} delay={n * 0.05}>
                    <div className="legacy-item"><span className="legacy-year">{e.year}</span><div><strong>{e.title}</strong><p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>{e.description}<Cite ids={e.source_ids} sources={i.sources} /></p></div></div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
          <aside className="room-side">
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
                <a className="btn btn-sm" style={{ marginTop: 14 }} href={api.lessonUrl(i.slug)}>⬇ Classroom packet</a>
              </div>
            )}
          </aside>
        </div>
      </Room>

      <Room n={7} id="explore" title="Explore further" lead="Check the evidence behind this exhibition, then keep going: other museums of migration, and your own family's story.">
        <div style={{ overflowX: "auto" }} id="sources">
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
        {i.review_notes.length > 0 && (
          <details style={{ marginTop: 22 }} id="review">
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
        )}
        <div className="explore-grid">
          <Link to="/share" className="cta-card cta-share"><span className="cta-emoji">✍️</span><span className="eyebrow">Share a Story</span><h3>Your family's journey belongs here too</h3><span className="cta-go">Tell your story →</span></Link>
          <div className="card">
            <span className="eyebrow">Other museums of migration</span>
            <ul className="context-sources" style={{ marginTop: 10 }}>
              {(explore ?? []).slice(0, 4).map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.title} ↗</a><small>{x.publisher}</small></li>)}
            </ul>
            <Link to="/educators" style={{ color: "var(--link)", textDecoration: "underline", fontSize: "0.9rem" }}>All resources for educators →</Link>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 12, flexWrap: "wrap" }}>
          {prev ? <Link className="btn" to={`/inductees/${prev.slug}`}>← {prev.name}</Link> : <span />}
          {next ? <Link className="btn" to={`/inductees/${next.slug}`}>{next.name} →</Link> : <span />}
        </div>
      </Room>
    </div>
  );
}
