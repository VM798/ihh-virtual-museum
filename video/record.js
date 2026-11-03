// Records each "record" segment of script.json by driving the running app in headless Chromium.
// The recording for a segment lasts as long as its narration (+ padding); scroll actions declared
// with "frac" take that fraction of the narration time so the pacing follows the voice-over.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { OUT, SCRIPT, durations } = require("./lib");

const BASE = SCRIPT.base_url;
const W = 1920, H = 1080;
const PAD_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothScroll(page, target, offset, ms) {
  await page.evaluate(async ({ target, offset, ms }) => {
    const startY = window.scrollY;
    let endY;
    if (typeof target === "number") endY = startY + target;
    else { const el = document.querySelector(target); endY = el ? el.getBoundingClientRect().top + startY + (offset || 0) : startY; }
    endY = Math.max(0, Math.min(endY, document.documentElement.scrollHeight - innerHeight));
    const t0 = performance.now();
    await new Promise((res) => {
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // ease in-out
        window.scrollTo(0, startY + (endY - startY) * e);
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }, { target, offset, ms });
}

async function run(page, seg, totalMs) {
  const t0 = Date.now();
  for (const a of seg.actions) {
    const elapsed = Date.now() - t0;
    const remaining = Math.max(0, totalMs - elapsed);
    if (a.goto) {
      await page.goto(BASE + a.goto, { waitUntil: "load", timeout: 60000 });
      await page.waitForSelector("#root > *, section, body", { timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await sleep(1200);
    } else if (a.jump) {
      // jump twice: images and reveal animations can shift the layout right after load
      const jump = () => page.evaluate(({ sel, offset }) => { const el = document.querySelector(sel); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (offset || 0)); }, { sel: a.jump, offset: a.offset || 0 });
      await jump(); await sleep(700); await jump(); await sleep(300);
    } else if (a.hold !== undefined) {
      await sleep(Math.min(remaining, a.hold * totalMs));
    } else if (a.scroll !== undefined) {
      const ms = a.frac ? a.frac * totalMs : (a.ms || 1500);
      await smoothScroll(page, a.scroll, a.offset || 0, Math.min(ms, remaining || ms));
    } else if (a.click) {
      await page.click(a.click, { timeout: 15000 });
      await sleep(250);
    } else if (a.type) {
      await page.click(a.type.selector);
      await page.type(a.type.selector, a.type.text, { delay: 45 });
    } else if (a.press) {
      await page.keyboard.press(a.press);
    } else if (a.waitFor) {
      await page.waitForSelector(a.waitFor, { timeout: a.timeout || 30000 });
    }
  }
  const left = totalMs - (Date.now() - t0);
  if (left > 0) await sleep(left);
  return Date.now() - t0;
}

(async () => {
  const only = process.argv[2];
  const dur = durations();
  const rawDir = path.join(OUT, "raw");
  fs.mkdirSync(rawDir, { recursive: true });
  const browser = await chromium.launch();
  for (const seg of SCRIPT.segments) {
    if (seg.kind !== "record") continue;
    if (only && seg.id !== only) continue;
    const totalMs = Math.round(dur[seg.id] * 1000) + PAD_MS;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: rawDir, size: { width: W, height: H } }, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.warn("  page error:", e.message));
    const t = await run(page, seg, totalMs);
    const video = page.video();
    await ctx.close();
    const tmp = await video.path();
    const target = path.join(rawDir, `${seg.id}.webm`);
    fs.renameSync(tmp, target);
    console.log(`recorded ${seg.id}: ${(t / 1000).toFixed(1)}s (narration ${dur[seg.id].toFixed(1)}s)`);
  }
  await browser.close();
})();
