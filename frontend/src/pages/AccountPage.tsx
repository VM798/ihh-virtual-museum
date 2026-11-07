import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Story } from "../lib/types";

const STAMPS_KEY = "ihh-kids-passport";

export default function AccountPage() {
  const { user, ready, signOut } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && !user) navigate("/signin", { replace: true, state: { from: "/account" } }); }, [ready, user, navigate]);
  useEffect(() => { if (user) api.myStories().then(setStories).catch(() => setStories([])); }, [user]);

  if (!ready || !user) return <Loader text="Checking your ticket…" />;

  let stamps = 0;
  try { stamps = (JSON.parse(localStorage.getItem(STAMPS_KEY) ?? "[]") as unknown[]).length; } catch { /* no passport yet */ }
  const since = new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const out = async () => { setBusy(true); try { await signOut(); navigate("/", { replace: true }); } finally { setBusy(false); } };

  return (
    <section className="section">
      <div className="container">
        <div className="account-head card">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div className="account-who">
            <span className="eyebrow">Your account</span>
            <h2>{user.name}</h2>
            <p className="muted">{user.email} · member since {since}</p>
          </div>
          <button className="btn" onClick={out} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
        </div>

        <div className="account-grid">
          <div className="card">
            <span className="eyebrow">Stories you've shared</span>
            {stories === null ? <p className="muted">Loading…</p> : stories.length === 0 ? (
              <>
                <h3 style={{ margin: "8px 0 6px" }}>Nothing yet.</h3>
                <p className="muted">Every family has an arrival story. Yours could sit beside the inductees'.</p>
                <Link className="btn btn-sm btn-primary" to="/share">Share a story</Link>
              </>
            ) : (
              <ul className="my-stories">
                {stories.map((s) => (
                  <li key={s.id}>
                    <div><strong>{s.title}</strong><small className="muted">{s.story_type_label} · {new Date(s.submitted_at).toLocaleDateString()}</small></div>
                    <span className={`badge ${s.status === "approved" ? "badge-ok" : "badge-blocked"}`}>{s.status === "approved" ? "✓ published" : s.status === "declined" ? "not published" : "⏳ in review"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <span className="eyebrow">Kids-mode passport</span>
            <h3 style={{ margin: "8px 0 6px" }}>{stamps} {stamps === 1 ? "stamp" : "stamps"} collected</h3>
            <p className="muted">Stamps are earned by finishing a quiz with Scout. They are saved in this browser.</p>
            <Link className="btn btn-sm" to="/educators/kids">Open kids mode</Link>
          </div>
          <div className="card">
            <span className="eyebrow">Keep exploring</span>
            <ul className="account-links">
              <li><Link to="/museum">Walk the museum hall</Link></li>
              <li><Link to="/inductees">Meet the inductees</Link></li>
              <li><Link to="/timeline">Travel the timeline</Link></li>
              <li><Link to="/contact?topic=Classroom%20visit">Book a live virtual visit</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
