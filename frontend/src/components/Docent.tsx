import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { DocentAnswer, Inductee } from "../lib/types";

export default function Docent({ i }: { i: Inductee }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<DocentAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { data: status } = useFetch(() => api.docentStatus(), []);
  const index = new Map(i.sources.map((s, n) => [s.id, { n: n + 1, s }]));

  const submit = async (question: string) => {
    if (question.trim().length < 3) return;
    setBusy(true); setErr(null); setAnswer(null); setQ(question);
    try { setAnswer(await api.ask(i.slug, question)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const suggestions = [
    `Why did ${i.name.split(" ").slice(-1)[0]} leave ${i.origin.country.split(" (")[0]}?`,
    "What is this person best known for?",
    `What happened in ${i.timeline[Math.floor(i.timeline.length / 2)].year}?`,
  ];

  return (
    <div className="docent" id="ask">
      <span className="eyebrow">Ask the docent</span>
      <h3 style={{ marginTop: 6 }}>Have a question about {i.name}?</h3>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>
        Answers come only from this profile's cited passages, with source numbers you can check below.
        {status && (status.live ? ` Powered by ${status.model}.` : " Running in offline retrieval mode until an OpenAI API key is configured.")}
      </p>
      <form onSubmit={(e) => { e.preventDefault(); submit(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question…" maxLength={500} />
        <button className="btn btn-primary" disabled={busy}>{busy ? "Thinking…" : "Ask"}</button>
      </form>
      <div className="suggest">
        {suggestions.map((s) => <button key={s} className="chip" type="button" onClick={() => submit(s)}>{s}</button>)}
      </div>
      {err && <div className="answer" style={{ color: "var(--bad)" }}>{err}</div>}
      {answer && (
        <div className="answer">
          {answer.answer}
          {answer.cited_source_ids.length > 0 && (
            <div style={{ marginTop: 14, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Sources: {answer.cited_source_ids.map((id) => { const e = index.get(id); return e ? <a key={id} href={`#src-${id}`} style={{ color: "var(--link)", marginRight: 8 }}>[{e.n}] {e.s.publisher}</a> : null; })}
            </div>
          )}
          {answer.note && <div className="faint" style={{ marginTop: 10, fontSize: "0.8125rem" }}>{answer.note}</div>}
        </div>
      )}
    </div>
  );
}
