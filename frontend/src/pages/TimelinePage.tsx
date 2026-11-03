import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Loader, { ErrorBox } from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { GlobalTimelineEvent } from "../lib/types";

const CATS: GlobalTimelineEvent["category"][] = ["origins", "immigration", "career", "milestone", "honor", "legacy"];

export default function TimelinePage() {
  const { data, error } = useFetch(() => api.timeline(), []);
  const [cats, setCats] = useState<Set<string>>(new Set(CATS));
  const [who, setWho] = useState<string | null>(null);

  const people = useMemo(() => {
    const m = new Map<string, { name: string; accent: string }>();
    (data ?? []).forEach((e) => m.set(e.slug, { name: e.name, accent: e.accent }));
    return Array.from(m.entries());
  }, [data]);

  const decades = useMemo(() => {
    const out = new Map<number, GlobalTimelineEvent[]>();
    (data ?? []).filter((e) => cats.has(e.category) && (!who || e.slug === who)).forEach((e) => {
      const d = Math.floor(e.year / 10) * 10;
      out.set(d, [...(out.get(d) ?? []), e]);
    });
    return Array.from(out.entries()).sort((a, b) => a[0] - b[0]);
  }, [data, cats, who]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loader />;

  const toggle = (c: string) => setCats((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div><span className="eyebrow">One timeline</span><h2>Two centuries of arrivals</h2><p>Every dated moment from all ten profiles, interleaved. Filter by kind of event or by person.</p></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {CATS.map((c) => <button key={c} className={`chip ${cats.has(c) ? "active" : ""}`} onClick={() => toggle(c)}><span className={`cat cat-${c}`} style={{ margin: 0 }}>{c}</span></button>)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 30 }}>
          <button className={`chip ${!who ? "active" : ""}`} onClick={() => setWho(null)}>Everyone</button>
          {people.map(([slug, p]) => <button key={slug} className={`chip ${who === slug ? "active" : ""}`} onClick={() => setWho(who === slug ? null : slug)}><span style={{ width: 8, height: 8, borderRadius: 4, background: p.accent }} />{p.name}</button>)}
        </div>
        {decades.map(([decade, events]) => (
          <div key={decade} style={{ marginBottom: 40 }}>
            <div className="decade">{decade}s</div>
            {events.map((e, idx) => (
              <div className="gtl-row" key={`${e.slug}-${idx}`}>
                <div className="y">{e.date ?? e.year}</div>
                <div className="gtl-ev">
                  <Link to={`/inductees/${e.slug}`}><img src={e.thumbnail} alt={e.name} style={{ borderColor: e.accent }} loading="lazy" /></Link>
                  <div>
                    <div className="who" style={{ color: e.accent }}>{e.name}<span className={`cat cat-${e.category}`}>{e.category}</span></div>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div className="muted" style={{ fontSize: "0.9rem" }}>{e.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
