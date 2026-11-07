import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import Loader, { ErrorBox } from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { GlobalTimelineEvent, Media } from "../lib/types";

type Cat = GlobalTimelineEvent["category"];
// Friendly names for the kinds of moments, written for young readers.
const KIND: Record<Cat, { emoji: string; label: string }> = {
  origins: { emoji: "🌱", label: "Growing up" },
  immigration: { emoji: "🚢", label: "Coming to America" },
  career: { emoji: "💼", label: "At work" },
  milestone: { emoji: "⭐", label: "A big moment" },
  honor: { emoji: "🏅", label: "An award" },
  legacy: { emoji: "🕊️", label: "Remembered" },
};
const MEDIA_KIND: Record<Media["kind"], string> = { image: "Photograph", video: "Film", audio: "Recording", document: "Document" };
const yearOf = (s: string | null) => { const k = s?.match(/\d{4}/); return k ? Number(k[0]) : null; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// Commons credit fields sometimes carry a raw URL or a doubled phrase; tidy them for the caption.
const tidyCredit = (c: string) => c.replace(/https?:\/\/\S+/g, "").replace(/(Unknown author)\s*\1/i, "$1").replace(/\s*·\s*·/g, " ·").replace(/^\s*·\s*/, "").trim() || "Unknown";

/* Story mode: pick a face, then scroll sideways through that person's life. Every moment is illustrated with the
   inductee's own media closest in date (a real photograph, film still, recording or document, with its credit);
   the marker on the life ruler can be dragged to scrub through the years. */
export default function TimelinePage() {
  const { data: events, error } = useFetch(() => api.timeline(), []);
  const { data: people } = useFetch(() => api.inductees(), []);
  const [params, setParams] = useSearchParams();
  const who = params.get("who") ?? people?.[0]?.slug ?? null;
  const person = people?.find((p) => p.slug === who) ?? people?.[0];
  const { data: full } = useFetch(() => (person ? api.inductee(person.slug) : Promise.resolve(null)), [person?.slug]);

  const moments = useMemo(() => (events ?? []).filter((e) => e.slug === person?.slug), [events, person]);
  const [step, setStep] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [bg, setBg] = useState<{ cur: string; prev: string | null }>({ cur: "", prev: null });
  const strip = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const wheelAcc = useRef(0);
  const wheelLock = useRef(0);
  const thisYear = new Date().getFullYear();

  const anim = useRef<number | null>(null);
  // Glide to a slide with a gentle ease; a new target cancels the glide in progress.
  const scrollTo = useCallback((i: number, smooth = true) => {
    const s = strip.current; const el = s?.children[i] as HTMLElement | undefined;
    if (!s || !el) return;
    const target = el.offsetLeft - (s.clientWidth - el.clientWidth) / 2;
    if (anim.current) cancelAnimationFrame(anim.current);
    if (!smooth || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { s.scrollLeft = target; return; }
    const from = s.scrollLeft, dist = target - from, dur = Math.min(900, 450 + Math.abs(dist) * 0.25), t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      s.scrollLeft = from + dist * ease(t);
      anim.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
  }, []);
  const go = useCallback((n: number) => { if (moments.length) scrollTo(clamp(step + n, 0, moments.length - 1)); }, [moments.length, step, scrollTo]);
  const pick = (slug: string) => { setParams({ who: slug }, { replace: true }); setStep(0); strip.current?.scrollTo({ left: 0 }); };

  // Which slide is centred in the strip right now.
  const onScroll = () => {
    const s = strip.current; if (!s) return;
    const mid = s.scrollLeft + s.clientWidth / 2;
    let best = 0, bestD = Infinity;
    Array.from(s.children).forEach((c, i) => { const el = c as HTMLElement; const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
    if (best !== step) setStep(best);
  };

  // A wheel over the strip turns one page per notch; at either end the page scrolls normally.
  useEffect(() => {
    const s = strip.current; if (!s) return;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const atStart = step === 0 && delta < 0, atEnd = step >= moments.length - 1 && delta > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      const now = Date.now(); if (now < wheelLock.current) return;
      wheelAcc.current += delta;
      if (Math.abs(wheelAcc.current) > 40) { go(wheelAcc.current > 0 ? 1 : -1); wheelAcc.current = 0; wheelLock.current = now + 650; }
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, [go, step, moments.length]);

  // Left and right arrow keys turn the pages too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const m = moments[clamp(step, 0, Math.max(0, moments.length - 1))];

  // Picture for a moment: the curated scene image, else the inductee's own media within a few years, else the portrait.
  const pics = (full?.media ?? [])
    .map((x) => ({ ...x, y: yearOf(x.year), img: x.thumbnail ?? (x.kind === "image" ? x.url : null) }))
    .filter((x): x is typeof x & { y: number; img: string } => x.img !== null && x.y !== null);
  const illustrate = (e: GlobalTimelineEvent) => {
    const year = e.year;
    if (e.image) return { src: e.image.thumbnail ?? e.image.url, label: e.image.year ? `${e.image.year}` : "Archival image", title: e.image.title, credit: `${tidyCredit(e.image.credit)} · ${e.image.license}`, link: e.image.source_url, exact: true };
    let best: (typeof pics)[number] | null = null, bestD = Infinity;
    for (const p of pics) { const d = Math.abs(p.y - year); if (d < bestD) { bestD = d; best = p; } }
    if (best && bestD <= 5) return { src: best.img, label: `${MEDIA_KIND[best.kind]}, ${best.year}`, title: best.title, credit: `${best.credit} · ${best.license}`, link: best.url, exact: bestD <= 3 };
    const h = full?.hero_image;
    return { src: h?.url ?? person?.thumbnail ?? "", label: "Portrait", title: person?.name ?? "", credit: h ? `${h.credit} · ${h.license}` : "", link: h?.source_url ?? person?.thumbnail ?? "", exact: true };
  };
  // Backdrop crossfade without an animation library: the previous picture stays underneath while the new one fades in.
  const bgSrc = m ? illustrate(m).src : "";
  useEffect(() => { setBg((b) => (b.cur === bgSrc ? b : { cur: bgSrc, prev: b.cur || null })); }, [bgSrc]);

  if (error) return <ErrorBox message={error} />;
  if (!events || !people || !person) return <Loader text="Opening the storybook…" />;

  const born = person.born_year, end = person.died_year ?? thisYear;
  const pos = (y: number) => ((clamp(y, born, end) - born) / Math.max(1, end - born)) * 100;
  const first = step === 0, last = step >= moments.length - 1;

  // Drag the marker along the life ruler to scrub through the moments.
  const yearAt = (clientX: number) => { const r = line.current!.getBoundingClientRect(); return Math.round(born + clamp((clientX - r.left) / r.width, 0, 1) * (end - born)); };
  const nearest = (year: number) => moments.reduce((bi, e, i) => (Math.abs(e.year - year) < Math.abs(moments[bi].year - year) ? i : bi), 0);
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => { const y = yearAt(e.clientX); setDrag(y); const i = nearest(y); if (i !== step) scrollTo(i); };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e); };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag !== null) scrub(e); };
  const onUp = () => setDrag(null);
  const markerYear = drag ?? m?.year ?? born;
  // Gentle parallax: the stage records where the cursor is (-1..1) and CSS tilts the card and shifts its picture.
  const parallax = (e: ReactMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--px", `${((e.clientX - r.left) / r.width - 0.5) * 2}`);
    e.currentTarget.style.setProperty("--py", `${((e.clientY - r.top) / r.height - 0.5) * 2}`);
  };
  const resetParallax = (e: ReactMouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty("--px", "0"); e.currentTarget.style.setProperty("--py", "0"); };

  return (
    <section className="section story-page" style={{ "--accent": person.accent } as CSSProperties}>
      <div className="container">
        <div className="story-picker" role="tablist" aria-label="Choose an inductee">
          {people.map((p) => (
            <button key={p.slug} type="button" role="tab" aria-selected={p.slug === person.slug} className={`story-face ${p.slug === person.slug ? "on" : ""}`} style={{ "--accent": p.accent } as CSSProperties} onClick={() => pick(p.slug)} title={p.name}>
              <img src={p.thumbnail} alt="" loading="lazy" />
              <span>{p.name.split(" ").slice(-1)[0]}</span>
            </button>
          ))}
        </div>

        <header className="story-head">
          <h2>{person.name}</h2>
          <p className="story-tag">{person.tagline}</p>
          <p className="story-meta">
            {person.origin_flag} {person.origin_country.split(" (")[0]} · arrived {person.immigration_year} · {born}–{person.died_year ?? "today"}
            <Link to={`/inductees/${person.slug}`}>Full exhibit →</Link>
          </p>
        </header>

      </div>

      <div className="story-stage" onMouseMove={parallax} onMouseLeave={resetParallax}>
        <div className="story-backdrop" aria-hidden="true">
          {bg.prev && <img key={`p-${bg.prev}`} src={bg.prev} alt="" />}
          {bg.cur && <img key={`c-${bg.cur}`} src={bg.cur} alt="" className="fade-in" />}
          <div className="story-veil" />
        </div>
        {m && <div key={`${m.year}-${step}`} className="story-ghost" aria-hidden="true">{m.year}</div>}

        <div className="container story-stage-inner">
          <div className="story-strip" ref={strip} onScroll={onScroll} tabIndex={0} aria-label={`${person.name}'s life, one moment at a time`}>
            {moments.map((e, i) => {
              const pic = illustrate(e);
              const age = e.year - born;
              const showAge = age > 0 && (!person.died_year || e.year <= person.died_year);
              return (
                <article key={`${e.year}-${i}`} className={`story-slide ${i === step ? "on" : ""}`} onClick={() => i !== step && scrollTo(i)}>
                  <figure className="story-pic">
                    <img className="story-pic-fill" src={pic.src} alt="" aria-hidden="true" loading={Math.abs(i - step) <= 1 ? "eager" : "lazy"} />
                    <img className="story-pic-main" src={pic.src} alt={pic.title} loading={Math.abs(i - step) <= 1 ? "eager" : "lazy"} />
                    <figcaption>
                      <span>{pic.title}{pic.label && !pic.exact ? " · nearest in date" : ""}</span>
                      {pic.credit && <small>{pic.credit} · <a href={pic.link} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>source</a></small>}
                    </figcaption>
                  </figure>
                  <div className="story-body">
                    <div className="story-kind">{KIND[e.category].emoji} {KIND[e.category].label}</div>
                    <div className="story-year">{e.date ?? e.year}{showAge && <small>age {age}</small>}</div>
                    <h3 className="story-title">{e.title}</h3>
                    <p className="story-text">{e.description}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="story-nav">
            <button type="button" className="story-btn" onClick={() => go(-1)} disabled={first} aria-label="Previous moment">← Back</button>
            <span className="story-count">{step + 1} <i>of</i> {moments.length}</span>
            {last
              ? <Link className="story-btn story-btn-accent" to={`/inductees/${person.slug}`}>See the exhibit →</Link>
              : <button type="button" className="story-btn story-btn-accent" onClick={() => go(1)} aria-label="Next moment">Next →</button>}
          </div>

          <div className="story-ruler">
            <div className={`story-line ${drag !== null ? "dragging" : ""}`} ref={line} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              role="slider" aria-label="Year" aria-valuemin={born} aria-valuemax={end} aria-valuenow={markerYear} tabIndex={0}
              onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}>
              <span className="story-fill" style={{ width: `${pos(markerYear)}%` }} />
              {moments.map((e, i) => {
                const pic = illustrate(e);
                return (
                  <span key={i} className={`story-tick ${i === step ? "on" : ""}`} style={{ left: `${pos(e.year)}%` }}>
                    <span className="tick-tip"><img src={pic.src} alt="" loading="lazy" /><b>{e.year}</b><i>{e.title}</i></span>
                  </span>
                );
              })}
              <span className="story-mark" style={{ left: `${pos(born)}%` }}>Born {born}</span>
              <span className="story-mark story-mark-mid" style={{ left: `${pos(person.immigration_year)}%` }}>Arrived {person.immigration_year}</span>
              <span className="story-mark" style={{ left: "100%" }}>{person.died_year ? `Died ${person.died_year}` : "Today"}</span>
              <span className="story-now" style={{ left: `${pos(markerYear)}%` }}><b>{markerYear}</b></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
