import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import type { ChatLink, ChatMessage, ChatReply } from "../lib/types";

/* "Ask the museum": a site-wide guide that answers about any inductee (from the cited profiles) and about
   the site itself. Lives in the corner of every page; the conversation survives navigation within the tab. */

type Turn = ChatMessage & { links?: ChatLink[]; note?: string | null; pending?: boolean };
const KEY = "ihh-guide-chat";
const WELCOME: Turn = { role: "assistant", content: "Welcome to the Immigrant Hall of Honor. I'm the museum guide. Ask me about any inductee, or how to walk the hall, share your story, or bring a class for a visit.", links: [{ label: "Walk the museum", to: "/museum" }, { label: "Meet the inductees", to: "/inductees" }] };
const STARTERS = ["Who is in the hall?", "Why did I. M. Pei come to the United States?", "How do I share my family's story?", "What can teachers use?"];

// Render **bold**, [label](/path) links and simple bullets from the guide's text.
function rich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*|\[(S\d+)\]/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<Link key={k++} to={m[2]}>{m[1]}</Link>);
    else if (m[3]) out.push(<strong key={k++}>{m[3]}</strong>);
    else out.push(<sup key={k++} className="cite">{m[4]}</sup>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(() => { try { const s = sessionStorage.getItem(KEY); return s ? (JSON.parse(s) as Turn[]) : [WELCOME]; } catch { return [WELCOME]; } });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ live: boolean; model: string } | null>(null);
  const [nudge, setNudge] = useState(false);
  const { pathname } = useLocation();
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inHall = pathname === "/museum";

  useEffect(() => { api.docentStatus().then((s) => setStatus({ live: s.live, model: s.model })).catch(() => setStatus(null)); }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(turns.filter((t) => !t.pending).slice(-30))); } catch { /* storage unavailable */ } }, [turns]);
  useEffect(() => { if (open) { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); input.current?.focus(); } }, [open, turns]);
  useEffect(() => { const t = setTimeout(() => setNudge(true), 9000); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, []);

  const ask = async (text: string) => {
    const content = text.trim(); if (content.length < 2 || busy) return;
    setQ(""); setBusy(true);
    const history = [...turns.filter((t) => !t.pending), { role: "user" as const, content }];
    setTurns([...history, { role: "assistant", content: "", pending: true }]);
    try {
      const r: ChatReply = await api.chat(history.slice(-10).map(({ role, content }) => ({ role, content })), pathname);
      setTurns([...history, { role: "assistant", content: r.answer, links: r.links, note: r.note }]);
    } catch (e) {
      setTurns([...history, { role: "assistant", content: `Sorry, I couldn't reach the museum right now (${(e as Error).message}). Please try again in a moment.` }]);
    } finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); ask(q); };
  const reset = () => { setTurns([WELCOME]); try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

  return (
    <div className={`guide ${open ? "open" : ""} ${inHall ? "in-hall" : ""}`}>
      {open && (
        <section className="guide-panel" role="dialog" aria-label="Museum guide chat">
          <header className="guide-head">
            <img src="/ihh/ihh-mark.png" alt="" width="34" height="34" />
            <div><strong>Museum Guide</strong><small>{status?.live ? `Answers from the cited profiles · ${status.model}` : "Answers from the cited profiles"}</small></div>
            <button type="button" className="guide-reset" onClick={reset} title="Start over">↺</button>
            <button type="button" className="guide-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </header>
          <div className="guide-log" ref={log}>
            {turns.map((t, k) => (
              <div key={k} className={`guide-msg ${t.role}`}>
                {t.pending ? <span className="guide-typing" aria-label="The guide is typing"><i /><i /><i /></span> : <p>{rich(t.content)}</p>}
                {t.links && t.links.length > 0 && <div className="guide-links">{t.links.slice(0, 6).map((l) => <Link key={l.to + l.label} to={l.to} onClick={() => setOpen(false)}>{l.label} →</Link>)}</div>}
                {t.note && <small className="guide-note">{t.note}</small>}
              </div>
            ))}
            {turns.length <= 1 && (
              <div className="guide-starters">{STARTERS.map((s) => <button type="button" key={s} onClick={() => ask(s)}>{s}</button>)}</div>
            )}
          </div>
          <form className="guide-form" onSubmit={submit}>
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about an inductee or the museum…" maxLength={500} aria-label="Your question" />
            <button type="submit" disabled={busy || q.trim().length < 2} aria-label="Send">➤</button>
          </form>
        </section>
      )}
      <button type="button" className={`guide-fab ${nudge && !open ? "nudge" : ""}`} onClick={() => { setOpen((o) => !o); setNudge(false); }} aria-expanded={open} aria-label={open ? "Close the museum guide" : "Ask the museum guide"}>
        <img src="/ihh/ihh-mark.png" alt="" width="26" height="26" />
        <span>{open ? "Close" : "Ask the museum"}</span>
      </button>
    </div>
  );
}
