import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Loader, { ErrorBox } from "../components/Loader";
import SourceBadge from "../components/SourceBadge";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function SourcesPage() {
  const { data, error } = useFetch(() => api.sources(), []);
  const [kind, setKind] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const kinds = useMemo(() => Array.from(new Set((data ?? []).map((s) => s.kind))).sort(), [data]);
  const shown = useMemo(() => (data ?? []).filter((s) =>
    (!kind || s.kind === kind) && (!status || (status === "manual" ? s.verification.method === "manual" : s.verification.status === status && s.verification.method !== "manual")) &&
    (!q || `${s.title} ${s.publisher} ${s.inductee_name}`.toLowerCase().includes(q.toLowerCase()))), [data, kind, status, q]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loader />;
  const counts = {
    ok: data.filter((s) => s.verification.status === "ok" && s.verification.method !== "manual").length,
    manual: data.filter((s) => s.verification.method === "manual").length,
    blocked: data.filter((s) => s.verification.status === "blocked").length,
    error: data.filter((s) => s.verification.status === "error").length,
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div><span className="eyebrow">Source library</span><h2>{data.length} references, all traceable</h2>
            <p>Every citation across the ten profiles. "Link ok" means the checker fetched the page successfully; "blocks bots" means the publisher refuses automated requests and a person should open the link to confirm.</p></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className={`chip ${!status ? "active" : ""}`} onClick={() => setStatus(null)}>All</button>
          <button className={`chip ${status === "ok" ? "active" : ""}`} onClick={() => setStatus("ok")}>✓ link ok ({counts.ok})</button>
          <button className={`chip ${status === "manual" ? "active" : ""}`} onClick={() => setStatus("manual")}>✓ manual ({counts.manual})</button>
          <button className={`chip ${status === "blocked" ? "active" : ""}`} onClick={() => setStatus("blocked")}>⚠ blocks bots ({counts.blocked})</button>
          {counts.error > 0 && <button className={`chip ${status === "error" ? "active" : ""}`} onClick={() => setStatus("error")}>✕ failed ({counts.error})</button>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
          {kinds.map((k) => <button key={k} className={`chip ${kind === k ? "active" : ""}`} onClick={() => setKind(kind === k ? null : k)}>{k}</button>)}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title, publisher or person" style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)", minWidth: 260 }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Inductee</th><th>Source</th><th>Publisher</th><th>Kind</th><th>Link check</th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={`${s.inductee_slug}-${s.id}`}>
                  <td><Link to={`/inductees/${s.inductee_slug}#sources`} style={{ color: "var(--link)" }}>{s.inductee_name}</Link><br /><span className="src-id">{s.id}</span></td>
                  <td><a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{s.title}</a>{s.note && <div className="faint" style={{ fontSize: "0.8125rem" }}>{s.note}</div>}</td>
                  <td>{s.publisher}</td>
                  <td><span className="tag">{s.kind}</span></td>
                  <td><SourceBadge v={s.verification} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
