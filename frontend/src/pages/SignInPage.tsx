import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Mode = "signin" | "register";

export default function SignInPage({ mode: initial = "signin" }: { mode?: Mode }) {
  const { user, ready, signIn, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { from?: string } | null)?.from ?? "/account";
  const [mode, setMode] = useState<Mode>(initial);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { setMode(initial); setErr(null); }, [initial]);
  useEffect(() => { if (ready && user) navigate(next, { replace: true }); }, [ready, user, next, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (mode === "register" && form.password !== form.confirm) { setErr("The two passwords do not match."); return; }
    setBusy(true);
    try {
      if (mode === "register") await register(form.name, form.email, form.password);
      else await signIn(form.email, form.password);
      navigate(next, { replace: true });
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  const strength = form.password.length === 0 ? null : form.password.length < 8 ? "Too short" : form.password.length < 12 ? "Okay" : "Strong";

  return (
    <section className="section auth-section">
      <div className="container auth-wrap">
        <div className="auth-side">
          <span className="eyebrow">{mode === "register" ? "Create an account" : "Welcome back"}</span>
          <h2>{mode === "register" ? "Keep your place in the hall." : "Sign in to the Virtual Museum."}</h2>
          <p className="muted">An account lets you keep track of the stories you share, come back to the inductees you've met, and hear from the museum team as the Central Texas building takes shape.</p>
          <ul className="auth-perks">
            <li><b>✍️</b><span>See the status of every story you've shared, from review to publication.</span></li>
            <li><b>🧳</b><span>Your kids-mode passport and favourites travel with you.</span></li>
            <li><b>🔒</b><span>We store your name and email only. Passwords are hashed and never shown to anyone.</span></li>
          </ul>
        </div>

        <form className="card form auth-card" onSubmit={submit} noValidate>
          <div className="auth-tabs" role="tablist" aria-label="Sign in or register">
            <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "on" : ""} onClick={() => { setMode("signin"); setErr(null); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setErr(null); }}>Register</button>
          </div>
          {mode === "register" && (
            <div className="field"><label htmlFor="a-name">Your name *</label><input id="a-name" autoComplete="name" required minLength={2} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="How we should greet you" /></div>
          )}
          <div className="field"><label htmlFor="a-email">Email *</label><input id="a-email" type="email" autoComplete="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" /></div>
          <div className="field">
            <label htmlFor="a-pass">Password *</label>
            <div className="pass-wrap">
              <input id="a-pass" type={show ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} />
              <button type="button" className="pass-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
            </div>
            {mode === "register" && strength && <small className={`pass-meter ${strength.toLowerCase().replace(" ", "-")}`}>{strength}</small>}
          </div>
          {mode === "register" && (
            <div className="field"><label htmlFor="a-confirm">Confirm password *</label><input id="a-confirm" type={show ? "text" : "password"} autoComplete="new-password" required value={form.confirm} onChange={(e) => set("confirm", e.target.value)} /></div>
          )}
          {err && <div className="form-err" role="alert">{err}</div>}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? "One moment…" : mode === "register" ? "Create account" : "Sign in"}</button>
            <span className="muted auth-switch">
              {mode === "register" ? <>Already have an account? <button type="button" className="linkish" onClick={() => setMode("signin")}>Sign in</button></> : <>New here? <button type="button" className="linkish" onClick={() => setMode("register")}>Create an account</button></>}
            </span>
          </div>
          <p className="auth-fine">By continuing you agree that the IHH team may contact you about stories you share. Read more <Link to="/about">about the museum</Link>.</p>
        </form>
      </div>
    </section>
  );
}
