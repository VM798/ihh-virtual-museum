import { Link } from "react-router-dom";
import Loader, { ErrorBox } from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function EducatorsPage() {
  const { data: people, error } = useFetch(() => api.inductees(), []);
  const { data: explore } = useFetch(() => api.explore(), []);
  if (error) return <ErrorBox message={error} />;
  if (!people) return <Loader text="Opening the classroom…" />;

  return (
    <>
      <section className="section about-hero">
        <div className="container">
          <div className="kids-tabs"><span className="on">For teachers</span><Link to="/educators/kids">Kids mode 🧳</Link></div>
          <span className="eyebrow">For educators</span>
          <h1 style={{ margin: "8px 0 14px" }}>Bring the museum into your classroom</h1>
          <p className="lead-wide">
            Every inductee profile is built as a small exhibition that students can walk through online: arrival, personal story, work, artifacts,
            historical context, legacy and further exploration. Each one comes with a ready-to-print classroom packet and can be the subject of a live virtual visit.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container edu-grid">
          <div className="card edu-card">
            <div className="icon-circle">🏛️</div>
            <h3>Walk the exhibition</h3>
            <p className="muted">Open any profile and follow the seven rooms in order, or jump to one from the room bar. Every paragraph carries a source number students can check.</p>
            <Link className="btn btn-sm" to="/inductees">Choose an inductee →</Link>
          </div>
          <div className="card edu-card">
            <div className="icon-circle">📄</div>
            <h3>Download a classroom packet</h3>
            <p className="muted">A Markdown file per inductee with a summary, historical context, key moments, primary sources, discussion prompts and three activities.</p>
            <a className="btn btn-sm" href="#packets">See the packets ↓</a>
          </div>
          <div className="card edu-card kids-promo">
            <div className="icon-circle">🧳</div>
            <h3>Kids mode</h3>
            <p className="muted">Scout the suitcase guides younger students through one inductee at a time: short cards, read-aloud, a three-question quiz and a passport stamp. Built for ages 7 to 12 from the same cited profiles.</p>
            <Link className="btn btn-primary btn-sm" to="/educators/kids">Open kids mode →</Link>
          </div>
          <div className="card edu-card">
            <div className="icon-circle">🎥</div>
            <h3>Book a live virtual visit</h3>
            <p className="muted">A 30- to 45-minute online session for your class, led by an IHH volunteer: one inductee's exhibition, the artifacts up close, and time for student questions, modelled on the <a href="https://asia-archive.si.edu/visit/live-online-learning-programs/" target="_blank" rel="noreferrer" style={{ color: "var(--link)", textDecoration: "underline" }}>Smithsonian's live online learning programs</a>.</p>
            <Link className="btn btn-primary btn-sm" to="/contact?topic=Classroom%20visit">Request a visit →</Link>
          </div>
        </div>
      </section>

      <section className="section" id="packets">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Classroom packets</span><h2>One packet per inductee</h2>
            <p>Markdown opens in Word, Google Docs or any text editor. Each packet ends with the full source list so students can trace every claim.</p></div></div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Inductee</th><th>Field</th><th>Arrived</th><th>Discussion prompts</th><th>Packet</th><th>Exhibition</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.slug}>
                    <td><strong>{p.name}</strong><br /><span className="faint small">{p.origin_flag} {p.origin_country.split(" (")[0]}</span></td>
                    <td>{p.field}</td>
                    <td>{p.immigration_year}</td>
                    <td>{p.event_count} moments · {p.source_count} sources</td>
                    <td><a className="btn btn-sm" href={api.lessonUrl(p.slug)}>⬇ packet.md</a></td>
                    <td><Link to={`/inductees/${p.slug}`} style={{ color: "var(--link)", textDecoration: "underline" }}>open →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">Explore further</span><h2>Other museums and archives of immigration</h2>
            <p>Virtual exhibitions and collections that pair well with these profiles, from Angel Island to the Immigration History Research Center.</p></div></div>
          {!explore ? <Loader /> : (
            <div className="grid cols-3">
              {explore.map((x) => (
                <a key={x.url} className="card about-link" href={x.url} target="_blank" rel="noreferrer">
                  <strong>{x.title} ↗</strong>
                  <div className="faint small" style={{ margin: "4px 0 8px" }}>{x.publisher}</div>
                  {x.note && <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>{x.note}</p>}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
