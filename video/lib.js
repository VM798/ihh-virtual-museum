// Shared helpers for the video pipeline.
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const FFMPEG = require("ffmpeg-static");
const FFPROBE = require("ffprobe-static").path;
const HERE = __dirname;
const OUT = path.join(HERE, "out");
const SCRIPT = JSON.parse(fs.readFileSync(path.join(HERE, "script.json"), "utf8"));

function probeDuration(file) {
  const out = execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return parseFloat(String(out).trim());
}

function ffmpeg(args, label) {
  const res = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${label || args.join(" ")}`);
}

function narrationFile(id) {
  return path.join(OUT, "narration", `${id}.mp3`);
}

function durations() {
  const d = {};
  for (const seg of SCRIPT.segments) d[seg.id] = probeDuration(narrationFile(seg.id));
  return d;
}

module.exports = { FFMPEG, FFPROBE, HERE, OUT, SCRIPT, probeDuration, ffmpeg, narrationFile, durations };
