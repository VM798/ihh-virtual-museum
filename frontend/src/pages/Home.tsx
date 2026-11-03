import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import InducteeCard from "../components/InducteeCard";
import Loader, { ErrorBox } from "../components/Loader";
import Reveal from "../components/Reveal";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

function Counter({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <motion.div className="num" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{value}</motion.div>
      <div className="label">{label}</div>
    </div>
  );
}

export default function Home() {
  const { data: people, error } = useFetch(() => api.inductees(), []);
  const { data: stats } = useFetch(() => api.stats(), []);
  if (error) return <ErrorBox message={error} />;
  if (!people) return <Loader />;
  const featured = people.slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="container">
          <motion.span className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Immigrant Hall of Honor · Virtual Museum</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
            They arrived with little. <em style={{ color: "var(--yellow)", fontStyle: "normal" }}>They changed everything.</em>
          </motion.h1>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            Ten inductees, {stats?.timeline_events ?? "hundreds of"} dated moments, {stats?.sources ?? "dozens of"} checked sources, and open-access photographs, recordings and documents.
            Every fact on this site links to the evidence behind it.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" to="/inductees">Enter the gallery →</Link>
            <Link className="btn" to="/timeline">Walk the timeline</Link>
          </motion.div>
          <motion.div className="portrait-wall" style={{ marginTop: 56 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }}>
            {people.map((p) => (
              <Link key={p.slug} to={`/inductees/${p.slug}`} title={p.name}>
                <img src={p.thumbnail} alt={p.name} loading="lazy" />
                <span>{p.name}</span>
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      {stats && (
        <section className="section" style={{ paddingTop: 20 }}>
          <div className="container kpi-row">
            <Counter value={stats.inductees} label="inductees profiled" />
            <Counter value={`${stats.verified_sources}/${stats.sources}`} label="sources with a passing link check" />
            <Counter value={stats.media} label="open-access media items" />
            <Counter value={`${stats.span_start}–${stats.span_end}`} label="years of history" />
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">Featured</span><h2>Begin with these stories</h2></div>
            <Link to="/inductees" className="btn btn-sm">All inductees →</Link>
          </div>
          <div className="grid cols-4">
            {featured.map((p, idx) => <InducteeCard key={p.slug} i={p} index={idx} />)}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container feature">
          <Reveal>
            <span className="eyebrow">How this museum is built</span>
            <h2 style={{ margin: "10px 0 16px" }}>Engaging for students, reliable for historians</h2>
            <p className="muted">
              Each profile starts from the existing Immigrant Hall of Honor page and deepens it with primary and institutional sources:
              patents, presidential libraries, national archives, the Nobel Foundation, university collections.
              Inline citations sit beside every paragraph, and an automated checker records when each link was last confirmed.
            </p>
            <p className="muted">
              Media comes from Wikimedia Commons, the Internet Archive, the Library of Congress and the Smithsonian, with licences stated on every item
              and caution notes where rights need a human check before publication.
            </p>
            <Link to="/integrate" className="btn">For the IHH web team →</Link>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="grid cols-2">
              {[
                ["🔎", "Cited", "Every paragraph, event and honour carries source numbers."],
                ["🔗", "Checked", "Links are re-verified by script; results are shown on each source."],
                ["🎧", "Multimedia", "1911 recordings, 1950 television, patent files, stereographs."],
                ["🤖", "AI docent", "Ask questions; answers are grounded in the cited text only."],
              ].map(([icon, title, body]) => (
                <div className="card" key={title}>
                  <div className="icon-circle">{icon}</div>
                  <strong>{title}</strong>
                  <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
