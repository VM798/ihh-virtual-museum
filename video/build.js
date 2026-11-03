// Assembles the final MP4: per-segment clips (recording or card + narration), concatenation,
// burned-in captions, and the synthesised music bed ducked under the voice.
const fs = require("node:fs");
const path = require("node:path");
const { OUT, SCRIPT, ffmpeg, narrationFile, durations, probeDuration } = require("./lib");

const FPS = 25;
const LEAD = 0.6;   // seconds before narration starts in each clip
const TAIL = 1.3;   // seconds after narration ends
const FADE = 0.35;

function srtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function sentences(text) {
  return text.match(/[^.!?:]+[.!?:]+(\s|$)|[^.!?:]+$/g).map((s) => s.trim()).filter(Boolean);
}

// Split a sentence into caption cues of at most two ~60-character lines, breaking at commas where possible.
function cues(sentence, max = 60) {
  const words = sentence.split(" "); const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const out = [];
  for (let i = 0; i < lines.length; i += 2) out.push(lines.slice(i, i + 2).join("\n"));
  return out;
}

(async () => {
  const dur = durations();
  const clipDir = path.join(OUT, "clips");
  fs.mkdirSync(clipDir, { recursive: true });

  // 1. one clip per segment -----------------------------------------------------------
  const clips = [];
  let cursor = 0;
  const srt = [];
  let n = 1;
  for (const seg of SCRIPT.segments) {
    const len = LEAD + dur[seg.id] + TAIL;
    const clip = path.join(clipDir, `${seg.id}.mp4`);
    const vf = `fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${(len - FADE).toFixed(3)}:d=${FADE}`;
    const af = `adelay=${Math.round(LEAD * 1000)}|${Math.round(LEAD * 1000)},apad,atrim=0:${len.toFixed(3)}`;
    if (seg.kind === "card") {
      const png = path.join(OUT, "cards", `${seg.card}.png`);
      const frames = Math.ceil(len * FPS);
      ffmpeg(["-loop", "1", "-framerate", String(FPS), "-i", png, "-i", narrationFile(seg.id),
        "-filter_complex", `[0:v]zoompan=z='min(zoom+0.00035,1.07)':d=${frames}:s=1920x1080:fps=${FPS},${vf}[v];[1:a]${af}[a]`,
        "-map", "[v]", "-map", "[a]", "-t", len.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", clip], seg.id);
    } else {
      const raw = path.join(OUT, "raw", `${seg.id}.webm`);
      ffmpeg(["-i", raw, "-i", narrationFile(seg.id),
        "-filter_complex", `[0:v]${vf}[v];[1:a]${af}[a]`,
        "-map", "[v]", "-map", "[a]", "-t", len.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", clip], seg.id);
    }
    const real = probeDuration(clip);
    // captions, one sentence at a time, spread over the narration proportionally to length
    const sents = sentences(seg.narration);
    const totalChars = sents.reduce((a, s) => a + s.length, 0);
    let t = cursor + LEAD;
    for (const s of sents) {
      const d = (s.length / totalChars) * dur[seg.id];
      const parts = cues(s);
      const totalLen = parts.reduce((a, c) => a + c.length, 0);
      let tt = t;
      for (const c of parts) {
        const dd = (c.length / totalLen) * d;
        srt.push(`${n++}\n${srtTime(tt)} --> ${srtTime(tt + dd - 0.05)}\n${c}\n`);
        tt += dd;
      }
      t += d;
    }
    clips.push(clip);
    cursor += real;
    console.log(`clip ${seg.id}: ${real.toFixed(2)}s`);
  }
  fs.writeFileSync(path.join(OUT, "captions.srt"), srt.join("\n"));
  const total = cursor;
  console.log(`total ${total.toFixed(1)}s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")})`);

  // 2. concatenate -------------------------------------------------------------------------
  const list = path.join(OUT, "concat.txt");
  fs.writeFileSync(list, clips.map((c) => `file '${c}'`).join("\n"));
  const concat = path.join(OUT, "concat.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat], "concat");

  // 3. music bed, ducked under the narration, plus burned-in captions ---------------------------
  const music = path.join(OUT, "music.wav");
  if (!fs.existsSync(music) || probeDuration(music) < total + 2) {
    require("node:child_process").execFileSync(process.execPath, [path.join(__dirname, "music.js"), String(Math.ceil(total + 8))], { stdio: "inherit" });
  }
  const srtPath = path.join(OUT, "captions.srt").replace(/\\/g, "/").replace(/:/g, "\\:");
  // libass sizes fonts against a 288px reference height, so FontSize=9 is about 34px at 1080p.
  const style = "FontName=Arial,FontSize=9,Bold=0,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H96000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=14,MarginL=40,MarginR=40,Alignment=2";
  const final = path.join(OUT, "IHH_Virtual_Museum_ChallengeX.mp4");
  ffmpeg(["-i", concat, "-i", music,
    "-filter_complex",
    `[0:a]asplit=2[v1][v2];` +
    `[1:a]atrim=0:${total.toFixed(3)},afade=t=out:st=${(total - 5).toFixed(3)}:d=5,volume=0.3[m];` +
    `[m][v1]sidechaincompress=threshold=0.03:ratio=2.5:attack=80:release=1000:makeup=1[md];` +
    `[md][v2]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout];` +
    `[0:v]subtitles='${srtPath}':force_style='${style}'[vout]`,
    "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final], "final");
  console.log("wrote", final, `${probeDuration(final).toFixed(1)}s`);
})();
