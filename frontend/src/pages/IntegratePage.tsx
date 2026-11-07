import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function IntegratePage() {
  const { data } = useFetch(() => api.inductees(), []);
  if (!data) return <Loader />;
  const origin = window.location.origin;
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <span className="eyebrow">For the IHH communications & website team</span>
        <h2 style={{ margin: "8px 0 16px" }}>Taking this content to immigranthallofhonor.org</h2>
        <p className="muted">
          The challenge asked for content "in a format that can be easily integrated into the existing web site". The IHH site runs on WordPress,
          so every profile is available in three ready-to-use forms, each carrying its citations and media rights notes.
        </p>

        <div className="grid cols-3" style={{ margin: "28px 0" }}>
          <div className="card"><div className="icon-circle">1</div><strong>HTML block</strong><p className="muted" style={{ fontSize: "0.9rem", margin: "6px 0 0" }}>Self-contained, inline-styled, no scripts: the full seven-room exhibition with pictures, context, audio-guide script and sources. Paste into a WordPress <em>Custom HTML</em> block or a page template.</p></div>
          <div className="card"><div className="icon-circle">2</div><strong>Markdown</strong><p className="muted" style={{ fontSize: "0.9rem", margin: "6px 0 0" }}>For editors who want to rewrite in the IHH voice while keeping the footnoted sources.</p></div>
          <div className="card"><div className="icon-circle">3</div><strong>JSON API</strong><p className="muted" style={{ fontSize: "0.9rem", margin: "6px 0 0" }}>Structured data for a custom WordPress block, a React widget, or the future storytelling platform.</p></div>
        </div>

        <h3>Download a profile</h3>
        <div style={{ overflowX: "auto", margin: "12px 0 32px" }}>
          <table>
            <thead><tr><th>Inductee</th><th>HTML</th><th>Markdown</th><th>JSON</th><th>Current IHH page</th></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.slug}>
                  <td><Link to={`/inductees/${p.slug}`} style={{ color: "var(--link)" }}>{p.name}</Link></td>
                  <td><a className="btn btn-sm" href={api.exportUrl(p.slug, "html")}>export.html</a></td>
                  <td><a className="btn btn-sm" href={api.exportUrl(p.slug, "md")}>export.md</a></td>
                  <td><a className="btn btn-sm" href={api.exportUrl(p.slug, "json")} target="_blank" rel="noreferrer">export.json</a></td>
                  <td><a href={`https://immigranthallofhonor.org/inductees/inductee-${p.slug === "i-m-pei" ? "i-m-pei" : p.slug}/`} target="_blank" rel="noreferrer" className="muted">open ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Audio guides</h3>
        <p className="muted">Each profile has a spoken introduction of about ninety seconds, scripted only from the cited passages. With an OpenAI key in <code>backend/.env</code>, run <code>python scripts/narrate.py</code> once to generate MP3 files; until then the site reads the same script aloud with the visitor's browser.</p>

        <h3>API endpoints</h3>
        <pre><code>{`GET  ${origin}/api/inductees                 # summaries (filter: ?field=Music&region=Europe)
GET  ${origin}/api/inductees/{slug}          # full profile with sources, media, timeline
GET  ${origin}/api/inductees/{slug}/export.html|md|json   # seven-room exhibition, cited
GET  ${origin}/api/inductees/{slug}/lesson.md        # classroom packet
GET  ${origin}/api/inductees/{slug}/narration        # audio-guide script (+ narration.mp3 when generated)
GET  ${origin}/api/inductees/search?q=patent
GET  ${origin}/api/timeline                  # all events, chronological
GET  ${origin}/api/sources                   # every citation with its last link check
GET  ${origin}/api/stats
POST ${origin}/api/docent/ask                {"slug": "hedy-lamarr", "question": "..."}
POST ${origin}/api/docent/annotate           {"slug": "john-muir", "media_id": "M1"}   # AI label draft
Interactive docs: ${origin}/docs`}</code></pre>

        <h3 style={{ marginTop: 32 }}>Editorial workflow we recommend</h3>
        <ol className="muted" style={{ lineHeight: 1.8 }}>
          <li>Open each profile's <strong>Editorial review notes</strong>: they list statements on the current IHH page that conflict with primary sources, with severity and citations.</li>
          <li>Check the <Link to="/sources" style={{ color: "var(--link)" }}>source library</Link>: anything marked "blocks bots" needs one human click to confirm; re-run <code>python scripts/verify_sources.py</code> before each publish.</li>
          <li>Media marked with a ⚠ rights note should be linked, not re-hosted, until rights are confirmed. Everything else is public domain or Creative Commons as credited.</li>
          <li>AI docent answers and AI label drafts are grounded in the cited text and always carry source numbers; treat drafts as a starting point for a curator, never as final copy.</li>
        </ol>
      </div>
    </section>
  );
}
