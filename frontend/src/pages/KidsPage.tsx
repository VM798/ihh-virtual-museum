import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import Loader, { ErrorBox } from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { Inductee, InducteeSummary } from "../lib/types";

/* Kids mode: a friendly guide called Scout (a travelling suitcase) walks younger visitors through one inductee at a
   time in short cards, reads aloud, asks three quiz questions built from the profile data, and stamps a passport.
   Everything shown comes from the same cited profiles; only the framing is simplified. */

const FIELD_EMOJI: Record<string, string> = { Diplomacy: "🌐", Music: "🎵", Science: "🔭", Entertainment: "🎭", "Invention & Film": "💡", Conservation: "🌲", "Sport & Education": "🏀", Architecture: "🏛️", Business: "👖" };
const STAMPS_KEY = "ihh-kids-passport";

function Scout({ mood = "happy", size = 120 }: { mood?: "happy" | "cheer" | "think" | "wave"; size?: number }) {
  const mouth = mood === "cheer" ? "M40 76 Q60 96 80 76" : mood === "think" ? "M46 80 Q60 76 74 80" : "M44 76 Q60 88 76 76";
  return (
    <svg className={`scout scout-${mood}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect x="44" y="8" width="32" height="14" rx="6" fill="#7a4b22" />
      <rect x="10" y="22" width="100" height="84" rx="14" fill="#c8884a" stroke="#7a4b22" strokeWidth="4" />
      <rect x="10" y="50" width="100" height="12" fill="#7a4b22" opacity=".35" />
      <rect x="24" y="22" width="8" height="84" fill="#7a4b22" opacity=".35" /><rect x="88" y="22" width="8" height="84" fill="#7a4b22" opacity=".35" />
      <circle cx="44" cy="56" r="7" fill="#fff" /><circle cx="76" cy="56" r="7" fill="#fff" />
      <circle cx={mood === "think" ? 46 : 45} cy="57" r="3.5" fill="#16213a" /><circle cx={mood === "think" ? 78 : 77} cy="57" r="3.5" fill="#16213a" />
      <path d={mouth} stroke="#16213a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="34" cy="68" r="4" fill="#ff9aa2" opacity=".8" /><circle cx="86" cy="68" r="4" fill="#ff9aa2" opacity=".8" />
      <rect x="66" y="30" width="26" height="16" rx="3" fill="#ffd133" transform="rotate(-12 79 38)" /><text x="70" y="42" fontSize="9" fontWeight="700" fill="#16213a" transform="rotate(-12 79 38)">IHH</text>
      {mood === "wave" && <path d="M108 70 q14 -10 6 -24" stroke="#c8884a" strokeWidth="10" strokeLinecap="round" fill="none" />}
    </svg>
  );
}

type Q = { q: string; options: string[]; answer: string; why: string };
function makeQuiz(i: Inductee, all: InducteeSummary[]): Q[] {
  const others = all.filter((p) => p.slug !== i.slug);
  const pick = <T,>(arr: T[], n: number, not: T) => { const pool = Array.from(new Set(arr.filter((x) => x !== not))); const out: T[] = []; while (out.length < n && pool.length) out.push(pool.splice((out.length * 7 + i.name.length) % pool.length, 1)[0]); return out; };
  const shuffle = <T,>(arr: T[]) => arr.map((v, k) => [((k * 31 + i.born.year) % 97), v] as [number, T]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const country = i.origin.country.split(" (")[0];
  const qs: Q[] = [
    { q: `Where was ${i.name.split(" ")[0]} born?`, options: shuffle([country, ...pick(others.map((p) => p.origin_country.split(" (")[0]), 2, country)]), answer: country, why: `${i.name} was born in ${i.born.place} in ${i.born.year}.` },
    { q: `In what year did ${i.name.split(" ").slice(-1)[0]} arrive in the United States?`, options: shuffle([String(i.immigration.year), ...pick(others.map((p) => String(p.immigration_year)), 2, String(i.immigration.year))]), answer: String(i.immigration.year), why: `${i.immigration.arrived}, in ${i.immigration.year}, at age ${i.immigration.year - i.born.year}.` },
    { q: `What kind of work made ${i.name.split(" ").slice(-1)[0]} famous?`, options: shuffle([i.field, ...pick(others.map((p) => p.field), 2, i.field)]), answer: i.field, why: i.tagline },
  ];
  return qs;
}

export default function KidsPage() {
  const { data: people, error } = useFetch(() => api.inductees(), []);
  const [slug, setSlug] = useState<string | null>(null);
  const { data: who } = useFetch(() => (slug ? api.inductee(slug) : Promise.resolve(null)), [slug]);
  const [card, setCard] = useState(0);
  const [qi, setQi] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [stamps, setStamps] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(STAMPS_KEY) ?? "[]"); } catch { return []; } });
  const [bubble, setBubble] = useState("Hi! I'm Scout. I've travelled with every one of these people. Pick a friend and I'll tell you their story!");
  const [mood, setMood] = useState<"happy" | "cheer" | "think" | "wave">("wave");
  const [speaking, setSpeaking] = useState(false);
  const burst = useRef<HTMLDivElement>(null);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => { try { localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps)); } catch { /* storage may be blocked */ } }, [stamps]);
  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel(); }, [canSpeak]);

  const cards = useMemo(() => {
    if (!who) return [];
    const first = who.name.split(" ")[0], last = who.name.split(" ").slice(-1)[0];
    const age = who.immigration.year - who.born.year;
    const list = [
      { title: `Meet ${who.name}`, emoji: FIELD_EMOJI[who.field] ?? "✨", text: `${who.tagline}.`, scout: `This is ${first}! ${who.origin.flag} ${first} came all the way from ${who.origin.country.split(" (")[0]}.` },
      { title: "Where it all began", emoji: "🏠", text: `${first} was born in ${who.born.place} in ${who.born.year}.`, scout: `Everyone starts somewhere. Can you find ${who.born.place.split(",").slice(-1)[0].trim()} on a map?` },
      { title: "The big journey", emoji: "🚢", text: `${who.immigration.detail}`, scout: age > 0 ? `${first} was ${age} years old. ${age < 18 ? "That's a kid, like you!" : "Imagine packing up your whole life!"}` : "What a journey!" },
      { title: "Something amazing", emoji: "⭐", text: who.achievements[0] ? `${who.achievements[0].title}${who.achievements[0].year ? ` (${who.achievements[0].year})` : ""}. ${who.achievements[0].description}` : who.summary, scout: "This is the part I love telling people about." },
    ];
    if (who.fun_facts[0]) list.push({ title: "Did you know?", emoji: "🤯", text: who.fun_facts[0].text, scout: "I didn't believe this one at first either!" });
    if (who.quotes[0]) list.push({ title: `${last} said…`, emoji: "💬", text: `“${who.quotes[0].text}”`, scout: "What do you think that means?" });
    list.push({ title: "Why we remember them", emoji: "🏅", text: who.summary, scout: `Ready for a quick quiz about ${first}? I bet you'll get them all!` });
    return list;
  }, [who]);
  const quiz = useMemo(() => (who && people ? makeQuiz(who, people) : []), [who, people]);
  const stage: "pick" | "cards" | "quiz" | "done" = !slug ? "pick" : card < cards.length ? "cards" : qi < quiz.length ? "quiz" : "done";

  const say = (text: string) => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.92; u.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    const v = voices.find((x) => /Samantha|Ava|Zoe|Natural|Google US English/i.test(x.name)) ?? voices[0]; if (v) u.voice = v;
    u.onend = () => setSpeaking(false); setSpeaking(true); window.speechSynthesis.speak(u);
  };
  const pop = (text: string, m: typeof mood = "happy") => { setBubble(text); setMood(m); };
  const choose = (p: InducteeSummary) => { setSlug(p.slug); setCard(0); setQi(0); setChosen(null); setScore(0); pop(`Great choice! Let's go meet ${p.name.split(" ")[0]}.`, "cheer"); };
  const next = () => { if (card + 1 < cards.length) { setCard(card + 1); pop(cards[card + 1].scout, card + 1 === cards.length - 1 ? "think" : "happy"); } else { setCard(cards.length); pop(quiz[0]?.q ?? "", "think"); } };
  const answer = (opt: string) => {
    if (chosen) return;
    setChosen(opt);
    const ok = opt === quiz[qi].answer;
    if (ok) { setScore((s) => s + 1); pop(`Yes! ${quiz[qi].why}`, "cheer"); confetti(); } else pop(`Not quite. ${quiz[qi].why}`, "think");
  };
  const nextQ = () => {
    if (qi + 1 < quiz.length) { setQi(qi + 1); setChosen(null); pop(quiz[qi + 1].q, "think"); }
    else { setQi(quiz.length); if (who && !stamps.includes(who.slug)) setStamps((s) => [...s, who.slug]); pop(score + (chosen === quiz[qi].answer ? 0 : 0) >= 2 ? "You earned a passport stamp! Who's next?" : "You still earn a stamp for finishing. Try another friend!", "cheer"); confetti(); }
  };
  const confetti = () => {
    const el = burst.current; if (!el) return;
    el.innerHTML = Array.from({ length: 18 }).map((_, k) => `<i style="left:${50 + (Math.sin(k * 1.7) * 34)}%;animation-delay:${k * 25}ms;background:${["#ed1b24", "#ffd133", "#0d5ab6", "#2f855a"][k % 4]}"></i>`).join("");
    window.setTimeout(() => { el.innerHTML = ""; }, 1400);
  };

  if (error) return <ErrorBox message={error} />;
  if (!people) return <Loader text="Scout is packing…" />;
  const accent = who?.accent ?? "#0d5ab6";

  return (
    <section className="kids" style={{ "--accent": accent } as CSSProperties}>
      <div className="container">
        <div className="kids-tabs"><Link to="/educators">For teachers</Link><span className="on">Kids mode</span></div>
        <div className="kids-top">
          <div>
            <span className="eyebrow">Kids mode</span>
            <h1>Scout's Hall of Heroes</h1>
            <p className="kids-lead">Meet people who moved to America and did amazing things. Pick a friend, hear their story, pass Scout's quiz, and stamp your passport.</p>
          </div>
          <div className="passport">
            <div className="passport-head">🛂 My passport <b>{stamps.length}/{people.length}</b></div>
            <div className="passport-stamps">
              {people.map((p) => <span key={p.slug} className={stamps.includes(p.slug) ? "got" : ""} title={p.name}>{stamps.includes(p.slug) ? FIELD_EMOJI[p.field] ?? "⭐" : "·"}</span>)}
            </div>
          </div>
        </div>

        <div className="kids-stage">
          <aside className="scout-box">
            <div className="scout-bubble" key={bubble}>{bubble}{canSpeak && <button type="button" className="scout-say" onClick={() => say(bubble)} aria-label="Read aloud">{speaking ? "🔈…" : "🔊"}</button>}</div>
            <button type="button" className="scout-btn" onClick={() => { if (who?.fun_facts.length) pop(who.fun_facts[(Math.random() * who.fun_facts.length) | 0].text, "cheer"); else pop("Pick a friend first and I'll share a secret about them!", "wave"); }} aria-label="Ask Scout for a fun fact">
              <Scout mood={mood} />
              <small>Tap me for a fun fact</small>
            </button>
            <div className="burst" ref={burst} aria-hidden="true" />
          </aside>

          <div className="kids-main">
            {stage === "pick" && (
              <>
                <h2 className="kids-h2">Pick a friend</h2>
                <div className="kids-grid">
                  {people.map((p) => (
                    <button type="button" key={p.slug} className={`kid-card ${stamps.includes(p.slug) ? "stamped" : ""}`} style={{ "--accent": p.accent } as CSSProperties} onClick={() => choose(p)}>
                      <img src={p.thumbnail} alt="" />
                      <b>{p.name}</b>
                      <span>{FIELD_EMOJI[p.field] ?? "✨"} {p.field}</span>
                      <em>{p.origin_flag} from {p.origin_country.split(" (")[0]}</em>
                      {stamps.includes(p.slug) && <i className="stamp">✔ stamped</i>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {stage === "cards" && who && (
              <div className="story-card-kids" key={card}>
                <div className="kids-progress">{cards.map((_, k) => <i key={k} className={k <= card ? "on" : ""} />)}</div>
                <div className="kids-card-top"><span className="kids-emoji">{cards[card].emoji}</span><h2>{cards[card].title}</h2></div>
                <div className="kids-card-body">
                  <img src={who.hero_image.thumbnail} alt={who.name} className="kids-portrait" />
                  <p>{cards[card].text}</p>
                </div>
                <div className="kids-actions">
                  {canSpeak && <button type="button" className="kids-btn ghost" onClick={() => say(`${cards[card].title}. ${cards[card].text}`)}>🔊 Read to me</button>}
                  {card > 0 && <button type="button" className="kids-btn ghost" onClick={() => setCard(card - 1)}>← Back</button>}
                  <button type="button" className="kids-btn" onClick={next}>{card + 1 < cards.length ? "Next →" : "Take the quiz! 🎯"}</button>
                </div>
              </div>
            )}

            {stage === "quiz" && who && (
              <div className="story-card-kids" key={`q${qi}`}>
                <div className="kids-progress">{quiz.map((_, k) => <i key={k} className={k <= qi ? "on" : ""} />)}</div>
                <div className="kids-card-top"><span className="kids-emoji">🎯</span><h2>Question {qi + 1} of {quiz.length}</h2></div>
                <p className="kids-q">{quiz[qi].q}</p>
                <div className="kids-options">
                  {quiz[qi].options.map((o) => (
                    <button type="button" key={o} disabled={!!chosen} className={`kids-opt ${chosen ? (o === quiz[qi].answer ? "right" : o === chosen ? "wrong" : "") : ""}`} onClick={() => answer(o)}>{o}</button>
                  ))}
                </div>
                {chosen && <div className="kids-actions"><button type="button" className="kids-btn" onClick={nextQ}>{qi + 1 < quiz.length ? "Next question →" : "Finish ✨"}</button></div>}
              </div>
            )}

            {stage === "done" && who && (
              <div className="story-card-kids done">
                <div className="kids-card-top"><span className="kids-emoji">🏅</span><h2>You did it!</h2></div>
                <p className="kids-q">You got <b>{score}</b> of {quiz.length} right about {who.name}. Your passport has a new stamp: {FIELD_EMOJI[who.field] ?? "⭐"}</p>
                <div className="kids-actions">
                  <button type="button" className="kids-btn" onClick={() => { setSlug(null); pop("Who's next? Pick another friend!", "wave"); }}>Pick another friend →</button>
                  <Link className="kids-btn ghost" to={`/timeline?who=${who.slug}`}>See {who.name.split(" ")[0]}'s timeline</Link>
                  <Link className="kids-btn ghost" to={`/inductees/${who.slug}`}>The grown-up exhibit</Link>
                </div>
              </div>
            )}
            {slug && !who && <Loader text="Scout is finding the story…" />}
          </div>
        </div>
        <p className="kids-foot muted small">For grown-ups: every fact here comes from the cited profiles. Teachers can find packets and the live-visit request on the <Link to="/educators" style={{ textDecoration: "underline" }}>educators page</Link>.</p>
      </div>
    </section>
  );
}
