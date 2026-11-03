import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api } from "../lib/api";
import type { DocentAnswer, Media } from "../lib/types";

const ICONS: Record<Media["kind"], string> = { image: "🖼", audio: "🎧", video: "🎬", document: "📜" };

function Thumb({ m, onOpen }: { m: Media; onOpen: () => void }) {
  if (m.kind === "image" && (m.thumbnail || m.embed_url)) {
    return <div className="thumb" onClick={onOpen}><img src={m.thumbnail ?? m.embed_url ?? ""} alt={m.title} loading="lazy" /></div>;
  }
  if (m.kind === "video" && m.embed_url && m.embed_url.includes("archive.org/embed/")) {
    return <iframe className="video-frame" src={m.embed_url} title={m.title} allowFullScreen loading="lazy" />;
  }
  if (m.kind === "video" && m.embed_url) {
    return <video className="video-frame" controls preload="metadata" poster={m.thumbnail ?? undefined} src={m.embed_url} />;
  }
  return (
    <a className="thumb" href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: "2.6rem" }}>
      {m.thumbnail ? <img src={m.thumbnail} alt={m.title} loading="lazy" /> : ICONS[m.kind]}
    </a>
  );
}

function AiLabel({ slug, m, live }: { slug: string; m: Media; live: boolean }) {
  const [draft, setDraft] = useState<DocentAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  if (!live) return null;
  const run = async () => { setBusy(true); try { setDraft(await api.annotate(slug, m.id)); } catch (e) { setDraft({ answer: "", cited_source_ids: [], model: null, grounded: false, note: (e as Error).message }); } finally { setBusy(false); } };
  return (
    <div>
      {!draft && <button className="chip" type="button" onClick={run} disabled={busy}>{busy ? "Drafting…" : "✨ Draft a museum label with AI"}</button>}
      {draft && (
        <div className="annotation" style={{ borderColor: "var(--brand)", color: "var(--text)", whiteSpace: "pre-wrap" }}>
          {draft.answer || draft.note}
          {draft.answer && <div className="faint" style={{ fontSize: "0.8125rem", marginTop: 6 }}>{draft.note} · {draft.model}</div>}
        </div>
      )}
    </div>
  );
}

export default function MediaGallery({ media, slug, aiLive = false }: { media: Media[]; slug: string; aiLive?: boolean }) {
  const [open, setOpen] = useState<Media | null>(null);
  return (
    <>
      <div className="media-grid">
        {media.map((m) => (
          <article className="media-card" key={m.id}>
            <Thumb m={m} onOpen={() => setOpen(m)} />
            <div className="body">
              <span className="kind">{ICONS[m.kind]} {m.kind}{m.year ? ` · ${m.year}` : ""}</span>
              <h4>{m.title}</h4>
              <p className="desc" style={{ margin: 0 }}>{m.description}</p>
              {m.kind === "audio" && m.embed_url && <audio controls preload="none" src={m.embed_url} />}
              {m.annotation && <div className="annotation">{m.annotation}</div>}
              {m.rights_note && <div className="rights">⚠ {m.rights_note}</div>}
              <AiLabel slug={slug} m={m} live={aiLive} />
              <div className="credit">
                {m.credit} · {m.license_url ? <a href={m.license_url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{m.license}</a> : m.license}
                {" · "}<a href={m.url} target="_blank" rel="noreferrer" style={{ color: "var(--link)" }}>source ↗</a>
              </div>
            </div>
          </article>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <button className="btn btn-sm close">Close ✕</button>
            <div onClick={(e) => e.stopPropagation()}>
              <motion.img initial={{ scale: 0.95 }} animate={{ scale: 1 }} src={open.embed_url ?? open.thumbnail ?? ""} alt={open.title} />
              <div className="cap"><strong>{open.title}</strong> · {open.credit} · {open.license}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
