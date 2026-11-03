// Synthesises a gentle, royalty-free ambient bed (no samples, no downloads) as out/music.wav.
// Slow pad chords in D major with a sparse bell arpeggio and a simple echo for space.
const fs = require("node:fs");
const path = require("node:path");
const { OUT } = require("./lib");

const SR = 44100;
const seconds = parseFloat(process.argv[2] || "330");
const N = Math.ceil(seconds * SR);

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// D major: I – V – vi – IV – I – IV – vi – V  (midi numbers, root position, low register)
const CHORDS = [
  [50, 54, 57, 62], [45, 49, 52, 57], [47, 50, 54, 59], [43, 47, 50, 55],
  [50, 54, 57, 62], [43, 47, 50, 55], [47, 50, 54, 59], [45, 49, 52, 57],
];
const CHORD_SEC = 7.5;
const ATTACK = 2.2, RELEASE = 2.6;

const L = new Float64Array(N), R = new Float64Array(N);

// --- pads ------------------------------------------------------------------
for (let ci = 0; ci * CHORD_SEC < seconds + CHORD_SEC; ci++) {
  const chord = CHORDS[ci % CHORDS.length];
  const start = ci * CHORD_SEC - ATTACK * 0.5;
  const end = start + CHORD_SEC + RELEASE;
  chord.forEach((midi, vi) => {
    const f = hz(midi);
    const pan = 0.5 + (vi - 1.5) * 0.12; // spread voices a little
    const phase0 = Math.random() * Math.PI * 2;
    const s0 = Math.max(0, Math.floor(start * SR)), s1 = Math.min(N, Math.floor(end * SR));
    for (let n = s0; n < s1; n++) {
      const t = n / SR - start;
      const env = Math.min(1, t / ATTACK) * Math.min(1, (end - start - t) / RELEASE);
      const vib = 1 + 0.0025 * Math.sin(2 * Math.PI * 0.18 * t + vi);
      const w = 2 * Math.PI * f * vib * t + phase0;
      const v = (Math.sin(w) + 0.35 * Math.sin(2 * w) + 0.12 * Math.sin(3 * w) + 0.5 * Math.sin(w * 1.002 + 1.3)) * env * 0.09;
      L[n] += v * (1 - pan); R[n] += v * pan;
    }
  });
}

// --- bell arpeggio -----------------------------------------------------------
const STEP = 0.75; // seconds between notes
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let k = 0; k * STEP < seconds; k++) {
  if (rnd() < 0.42) continue; // leave space
  const ci = Math.floor((k * STEP) / CHORD_SEC) % CHORDS.length;
  const chord = CHORDS[ci];
  const midi = chord[Math.floor(rnd() * chord.length)] + 24; // two octaves up
  const f = hz(midi);
  const start = k * STEP + rnd() * 0.05;
  const s0 = Math.floor(start * SR), s1 = Math.min(N, s0 + SR * 3);
  const pan = 0.3 + rnd() * 0.4;
  for (let n = s0; n < s1; n++) {
    const t = (n - s0) / SR;
    const env = Math.exp(-t * 2.4) * Math.min(1, t / 0.006);
    const w = 2 * Math.PI * f * t;
    const v = (Math.sin(w) + 0.3 * Math.sin(2.01 * w) + 0.1 * Math.sin(3 * w)) * env * 0.05;
    L[n] += v * (1 - pan); R[n] += v * pan;
  }
}

// --- simple stereo echo for space ---------------------------------------------
function echo(buf, delaySec, fb) {
  const d = Math.floor(delaySec * SR);
  for (let n = d; n < N; n++) buf[n] += buf[n - d] * fb;
}
echo(L, 0.31, 0.28); echo(R, 0.37, 0.28); echo(L, 0.53, 0.14); echo(R, 0.47, 0.14);

// --- global fade in/out and normalise ------------------------------------------
let peak = 0;
for (let n = 0; n < N; n++) { peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n])); }
const g = 0.7 / (peak || 1);
const FADE_IN = 3 * SR, FADE_OUT = 6 * SR;
const pcm = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  let env = 1;
  if (n < FADE_IN) env = n / FADE_IN;
  if (n > N - FADE_OUT) env = Math.min(env, (N - n) / FADE_OUT);
  const l = Math.max(-1, Math.min(1, L[n] * g * env)), r = Math.max(-1, Math.min(1, R[n] * g * env));
  pcm.writeInt16LE(Math.round(l * 32767), n * 4);
  pcm.writeInt16LE(Math.round(r * 32767), n * 4 + 2);
}

// --- WAV container ------------------------------------------------------------
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
fs.mkdirSync(OUT, { recursive: true });
const target = path.join(OUT, "music.wav");
fs.writeFileSync(target, Buffer.concat([header, pcm]));
console.log("wrote", target, `${seconds}s`);
