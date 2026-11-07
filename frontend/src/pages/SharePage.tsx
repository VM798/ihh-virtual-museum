import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { IHH_LINKS } from "../components/Social";
import Loader from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import type { Story, StoryType } from "../lib/types";

const TYPE_HELP: Record<StoryType, string> = {
  contemporary: "You, or someone you know, came to the United States in living memory.",
  legacy: "An ancestor's journey, passed down through your family.",
  "what-we-bring": "A recipe, a craft, a song, an object or a tradition that travelled with you.",
};

function StoryCard({ s, mine = false }: { s: Story; mine?: boolean }) {
  const when = new Date(s.submitted_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return (
    <article className={`visitor-story ${mine ? "mine" : ""}`}>
      <div className="visitor-meta">
        <span className="tag">{s.story_type_label}</span>
        <span className={`badge ${s.status === "approved" ? "badge-ok" : "badge-blocked"}`}>{s.status === "approved" ? "✓ published" : "⏳ awaiting review"}</span>
      </div>
      <h4>{s.title}</h4>
      <div className="visitor-who">{s.origin_flag ? `${s.origin_flag} ` : ""}{s.display_name} · from {s.origin_country}{s.arrival_year ? ` · arrived ${s.arrival_year}` : ""} · shared {when}</div>
      <p>{s.story}</p>
    </article>
  );
}

export default function SharePage() {
  const { data: stories } = useFetch(() => api.stories(), []);
  const { data: types } = useFetch(() => api.storyTypes(), []);
  const [form, setForm] = useState({ name: "", display_name: "", email: "", origin_country: "", arrival_year: "", story_type: "contemporary" as StoryType, title: "", story: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<Story[]>([]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const { user } = useAuth();
  useEffect(() => { if (user) setForm((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email })); }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const saved = await api.submitStory({
        name: form.name, display_name: form.display_name || undefined, email: form.email, origin_country: form.origin_country,
        arrival_year: form.arrival_year ? Number(form.arrival_year) : null, story_type: form.story_type, title: form.title, story: form.story, consent: form.consent,
      });
      setMine((m) => [saved, ...m]);
      setForm({ name: "", display_name: "", email: "", origin_country: "", arrival_year: "", story_type: "contemporary", title: "", story: "", consent: false });
      document.getElementById("shared")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  if (!types) return <Loader text="Opening the story desk…" />;
  const all = [...mine, ...(stories ?? []).filter((s) => !mine.some((m) => m.id === s.id))];

  return (
    <section className="section share-page">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Share a Story</span>
            <h2>Tell your family's immigration story</h2>
            <p>At the Immigrant Hall of Honor, we celebrate immigrants whose journeys helped shape America and the world. Your story belongs in that record too.</p>
          </div>
        </div>

        <div className="share-grid">
          <form className="card form" onSubmit={submit}>
            <div className="field">
              <label>What kind of story is it?</label>
              <div className="radio-cards">
                {types.map((t) => (
                  <label key={t.id} className={`radio-card ${form.story_type === t.id ? "on" : ""}`}>
                    <input type="radio" name="story_type" value={t.id} checked={form.story_type === t.id} onChange={() => set("story_type", t.id)} />
                    <span><strong>{t.label}</strong><small>{TYPE_HELP[t.id]}</small></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="s-name">Your name *</label><input id="s-name" required minLength={2} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="First and last name" /></div>
              <div className="field"><label htmlFor="s-display">Name to show on the site</label><input id="s-display" value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="e.g. Rosa D., or “The Nguyen family”" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="s-email">Email *</label><input id="s-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Never shown publicly" /></div>
              <div className="field"><label htmlFor="s-country">Country of origin *</label><input id="s-country" required minLength={2} value={form.origin_country} onChange={(e) => set("origin_country", e.target.value)} placeholder="Where the journey began" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="s-year">Year of arrival</label><input id="s-year" type="number" min={1600} max={2100} value={form.arrival_year} onChange={(e) => set("arrival_year", e.target.value)} placeholder="e.g. 1998" /></div>
              <div className="field"><label htmlFor="s-title">Give your story a title *</label><input id="s-title" required minLength={3} maxLength={160} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Two suitcases and a sewing machine" /></div>
            </div>
            <div className="field">
              <label htmlFor="s-story">Your story *</label>
              <textarea id="s-story" required minLength={40} maxLength={10000} rows={9} value={form.story} onChange={(e) => set("story", e.target.value)} placeholder="Who travelled, where from, what they carried, what they found. Write it the way you would tell it at the kitchen table." />
              <small className="faint">{form.story.length.toLocaleString()} / 10,000 characters · at least 40</small>
            </div>
            <label className="check">
              <input type="checkbox" required checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>I consent to the Immigrant Hall of Honor sharing this story on its website and in its programs. I understand it will be read by the IHH team before it is published, and that my email is used only to contact me about it.</span>
            </label>
            {err && <div className="form-err">Could not send the story: {err}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Share my story"}</button>
              <a className="btn btn-sm" href={IHH_LINKS.tellYourStory} target="_blank" rel="noreferrer">Add audio or photos on the official form ↗</a>
            </div>
          </form>

          <aside className="share-side">
            <div className="card">
              <span className="eyebrow">What happens next</span>
              <ol className="steps">
                <li><b>1</b> Your story is saved and marked <em>awaiting review</em>.</li>
                <li><b>2</b> The IHH team reads it and may write to you with questions.</li>
                <li><b>3</b> Once approved it appears here and can join the museum's collection.</li>
              </ol>
              <p className="muted small" style={{ margin: 0 }}>Want to honour someone else? <a href={IHH_LINKS.nominate} target="_blank" rel="noreferrer" style={{ color: "var(--link)", textDecoration: "underline" }}>Nominate them for induction ↗</a></p>
            </div>
          </aside>
        </div>

        <div id="shared" className="section-head" style={{ marginTop: 48 }}>
          <div><span className="eyebrow">Stories from visitors</span><h2>{all.length ? `${all.length} ${all.length === 1 ? "story" : "stories"} shared so far` : "Be the first to share"}</h2>
            <p>Shared by people like you. Each one is read by the IHH team before it is published.</p></div>
        </div>
        {!stories ? <Loader text="Gathering stories…" /> : (
          <div className="story-list">
            {all.map((s) => <StoryCard key={s.id} s={s} mine={mine.some((m) => m.id === s.id)} />)}
            {!all.length && <div className="card muted">No stories yet. Yours could be the first.</div>}
          </div>
        )}
      </div>
    </section>
  );
}
