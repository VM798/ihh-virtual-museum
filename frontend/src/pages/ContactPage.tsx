import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Social, { IHH_LINKS } from "../components/Social";
import Loader from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function ContactPage() {
  const { data: topics } = useFetch(() => api.contactTopics(), []);
  const [params] = useSearchParams();
  const preset = params.get("topic");
  const [form, setForm] = useState({ name: "", email: "", phone: "", topics: preset ? [preset] : ([] as string[]), message: preset === "Classroom visit" ? "School / grade:\nNumber of students:\nInductee(s) of interest:\nPreferred dates and times:\n" : "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const toggle = (t: string) => setForm((f) => ({ ...f, topics: f.topics.includes(t) ? f.topics.filter((x) => x !== t) : [...f.topics, t] }));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await api.submitContact({ name: form.name, email: form.email, phone: form.phone || undefined, topics: form.topics, message: form.message });
      setDone(r); setForm({ name: "", email: "", phone: "", topics: [], message: "" });
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  if (!topics) return <Loader text="Opening the mailroom…" />;

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div><span className="eyebrow">Contact Us</span><h2>Tell us a little about how we can help</h2>
            <p>Questions about the museum, the inductees, volunteering, partnerships or press. The team reads every message.</p></div>
        </div>
        <div className="share-grid">
          {done ? (
            <div className="card form-ok">
              <span className="eyebrow">Message received</span>
              <h3 style={{ margin: "6px 0 10px" }}>Thank you. We'll be in touch.</h3>
              <p className="muted">Your message has been logged with reference <code>{done.id}</code>. In the meantime, you might like to <Link to="/share" style={{ color: "var(--link)", textDecoration: "underline" }}>share your family's story</Link> or <Link to="/inductees" style={{ color: "var(--link)", textDecoration: "underline" }}>meet the inductees</Link>.</p>
              <button className="btn btn-sm" onClick={() => setDone(null)}>Send another message</button>
            </div>
          ) : (
            <form className="card form" onSubmit={submit}>
              <div className="field-row">
                <div className="field"><label htmlFor="c-name">Name *</label><input id="c-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="c-email">Email *</label><input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="field"><label htmlFor="c-phone">Phone</label><input id="c-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></div>
              <div className="field">
                <label>What is this about?</label>
                <div className="topic-chips">
                  {topics.map((t) => <button type="button" key={t} className={`chip ${form.topics.includes(t) ? "active" : ""}`} onClick={() => toggle(t)} aria-pressed={form.topics.includes(t)}>{t}</button>)}
                </div>
              </div>
              <div className="field"><label htmlFor="c-msg">Message *</label><textarea id="c-msg" required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us a little about how we can help." /></div>
              {err && <div className="form-err">Could not send: {err}</div>}
              <div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send message"}</button></div>
            </form>
          )}

          <aside className="share-side">
            <div className="card">
              <span className="eyebrow">Other ways to reach IHH</span>
              <p className="muted small">The Immigrant Hall of Honor does not publish a phone number or mailing address. The official site takes messages through its contact form, and the team is active on social media.</p>
              <a className="btn btn-sm" href={IHH_LINKS.contact} target="_blank" rel="noreferrer">Official contact page ↗</a>
              <div style={{ marginTop: 16 }}><Social labels className="social-stack" /></div>
            </div>
            <div className="card" style={{ marginTop: 14 }}>
              <span className="eyebrow">A new museum coming to Central Texas</span>
              <p className="muted small" style={{ margin: "8px 0 10px" }}>Support the foundation of an interactive national museum.</p>
              <a className="btn btn-primary btn-sm" href={IHH_LINKS.donate} target="_blank" rel="noreferrer">Donate ↗</a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
