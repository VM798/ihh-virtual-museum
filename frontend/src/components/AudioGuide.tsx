import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { Inductee } from "../lib/types";

/* Audio guide for one exhibit. Plays the generated MP3 when the backend has one; otherwise the browser's own
   speech synthesis reads the same script, which is built only from the profile's cited passages. */
export default function AudioGuide({ i }: { i: Inductee }) {
  const { data: n } = useFetch(() => api.narration(i.slug), [i.slug]);
  const [playing, setPlaying] = useState(false);
  const [para, setPara] = useState(-1);
  const [open, setOpen] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = () => {
    if (audio.current) { audio.current.pause(); audio.current.currentTime = 0; }
    if (canSpeak) window.speechSynthesis.cancel();
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setPlaying(false); setPara(-1);
  };
  useEffect(() => stop, [i.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser reading: the most natural English voice available, a storyteller's pace, and a real pause between paragraphs.
  const timer = useRef<number | null>(null);
  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    const prefer = [/Samantha/i, /Ava/i, /Allison/i, /Zoe/i, /Natural/i, /Neural/i, /Premium/i, /Enhanced/i, /Google US English/i, /Aria/i, /Jenny/i];
    for (const re of prefer) { const v = voices.find((x) => re.test(x.name) && /US|en_US|en-US/i.test(x.lang)); if (v) return v; }
    return voices.find((v) => /US/i.test(v.lang)) ?? voices[0] ?? null;
  };
  const speak = () => {
    if (!n || !canSpeak) return;
    window.speechSynthesis.cancel();
    const voice = pickVoice();
    const sayFrom = (k: number) => {
      if (k >= n.paragraphs.length) { setPlaying(false); setPara(-1); return; }
      const u = new SpeechSynthesisUtterance(n.paragraphs[k]);
      u.lang = "en-US"; u.rate = 0.9; u.pitch = 1.02; if (voice) u.voice = voice;
      u.onstart = () => setPara(k);
      u.onend = () => { timer.current = window.setTimeout(() => sayFrom(k + 1), 650); };
      u.onerror = () => { setPlaying(false); setPara(-1); };
      window.speechSynthesis.speak(u);
    };
    setPlaying(true);
    // Voices load lazily in some browsers; wait for them once.
    if (window.speechSynthesis.getVoices().length === 0) window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; sayFrom(0); };
    else sayFrom(0);
  };

  const toggle = () => {
    if (!n) return;
    if (playing) { stop(); return; }
    if (n.audio_url && audio.current) { audio.current.play(); setPlaying(true); } else speak();
  };

  if (!n) return null;
  const mins = Math.max(1, Math.round(n.seconds / 60));
  const mode = n.audio_url ? `AI narration · ${n.audio_generated_with}` : canSpeak ? "Read aloud by your browser" : "Script only";

  return (
    <div className="audio-guide" style={{ ["--accent" as string]: i.accent }}>
      <button type="button" className={`ag-play ${playing ? "on" : ""}`} onClick={toggle} disabled={!n.audio_url && !canSpeak} aria-pressed={playing} aria-label={playing ? "Stop the audio guide" : "Play the audio guide"}>
        {playing ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                 : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <div className="ag-body">
        <div className="ag-title">Audio guide <span>· about {mins} min · {mode}</span></div>
        <div className="ag-bars" aria-hidden="true">{Array.from({ length: 28 }).map((_, k) => <i key={k} style={{ animationDelay: `${(k % 7) * 0.12}s`, height: `${30 + ((k * 37) % 60)}%` }} />)}</div>
        <button type="button" className="ag-script" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide script" : "Read the script"} · built from sources {n.source_ids.map((s) => `[${i.sources.findIndex((x) => x.id === s) + 1}]`).join(" ")}</button>
        {open && <div className="ag-text">{n.paragraphs.map((p, k) => <p key={k} className={k === para ? "now" : ""}>{p}</p>)}</div>}
      </div>
      {n.audio_url && <audio ref={audio} src={api.narrationUrl(i.slug)} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />}
    </div>
  );
}
