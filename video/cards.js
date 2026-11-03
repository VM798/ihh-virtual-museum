// Renders the title, challenge and closing cards to 1920x1080 PNGs with headless Chromium.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { HERE, OUT } = require("./lib");

const LOGO = "file://" + path.join(HERE, "..", "frontend", "public", "ihh", "ihh-logo-white.png");
const MARK = "file://" + path.join(HERE, "..", "frontend", "public", "ihh", "ihh-mark.png");

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; } html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; }
  body { font-family: Montserrat, Arial, sans-serif; color: #fff; background: #0d5ab6; position: relative; }
  .glow { position: absolute; right: -260px; top: -260px; width: 980px; height: 980px; border-radius: 50%;
          background: radial-gradient(circle, rgba(125,178,241,0.5), transparent 68%); }
  .glow2 { position: absolute; left: -300px; bottom: -420px; width: 900px; height: 900px; border-radius: 50%;
           background: radial-gradient(circle, rgba(237,27,36,0.35), transparent 68%); }
  .wrap { position: absolute; inset: 0; padding: 120px 160px; display: flex; flex-direction: column; justify-content: center; }
  .eyebrow { font-size: 22px; font-weight: 600; letter-spacing: 5px; text-transform: uppercase; color: #ffd133; margin-bottom: 28px; }
  h1 { font-size: 88px; font-weight: 700; line-height: 1.08; letter-spacing: .03em; text-transform: uppercase; margin: 0 0 26px; max-width: 1400px; }
  h2 { font-size: 60px; font-weight: 700; line-height: 1.1; letter-spacing: .03em; margin: 0 0 40px; text-transform: uppercase; }
  p.lead { font-size: 30px; line-height: 1.5; color: #cae2ff; max-width: 1200px; margin: 0; }
  .logo { height: 120px; width: auto; margin-bottom: 60px; }
  .rule { width: 160px; height: 8px; background: #ed1b24; margin-bottom: 44px; }
  .foot { position: absolute; left: 160px; right: 160px; bottom: 80px; display: flex; justify-content: space-between; font-size: 22px; letter-spacing: 3px; text-transform: uppercase; color: #cae2ff; }
  ol { list-style: none; counter-reset: n; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 28px 48px; max-width: 1560px; }
  ol li { counter-increment: n; background: rgba(255,255,255,0.08); border-left: 8px solid #ed1b24; padding: 28px 34px 28px 110px; border-radius: 6px; font-size: 30px; line-height: 1.4; position: relative; }
  ol li::before { content: counter(n); position: absolute; left: 30px; top: 22px; font-size: 54px; font-weight: 700; color: #ffd133; }
  ol li b { display: block; font-weight: 700; margin-bottom: 4px; }
  .stats { display: flex; gap: 40px; margin: 10px 0 50px; }
  .stat { flex: 1; background: rgba(255,255,255,0.08); border-top: 8px solid #ffd133; padding: 30px 34px; border-radius: 6px; }
  .stat .n { font-size: 84px; font-weight: 700; line-height: 1; letter-spacing: .03em; }
  .stat .l { font-size: 24px; color: #cae2ff; margin-top: 10px; line-height: 1.3; }
  .mark { position: absolute; right: 150px; top: 110px; height: 220px; opacity: 0.9; }
`;

const CARDS = {
  title: `
    <div class="glow"></div><div class="glow2"></div>
    <div class="wrap">
      <img class="logo" src="${LOGO}" alt="">
      <div class="eyebrow">Challenge X · Submission</div>
      <h1>The IHH Virtual Museum</h1>
      <div class="rule"></div>
      <p class="lead">Ten inductees. Every claim cited. Every source checked. Historical media, AI annotation and an AI docent, ready for immigranthallofhonor.org.</p>
    </div>
    <div class="foot"><span>Immigrant Hall of Honor</span><span>Python · FastAPI · React · OpenAI</span></div>`,
  challenge: `
    <div class="glow"></div>
    <img class="mark" src="${MARK}" alt="">
    <div class="wrap">
      <div class="eyebrow">What Challenge X asked for</div>
      <h2>Four requirements</h2>
      <ol>
        <li><b>Start from the IHH website</b>Build on each inductee's existing page.</li>
        <li><b>Deepen with verifiable sources</b>Public, reliable, open-access references for every fact.</li>
        <li><b>Add multimedia</b>Historical video and audio, artifact images with AI annotation, AI-generated media.</li>
        <li><b>Easy to integrate</b>A format the WordPress team can drop in, aimed at young people.</li>
      </ol>
    </div>
    <div class="foot"><span>Minimum: 4 inductees</span><span>Delivered: all 10</span></div>`,
  closing: `
    <div class="glow"></div><div class="glow2"></div>
    <div class="wrap">
      <div class="eyebrow">In summary</div>
      <div class="stats">
        <div class="stat"><div class="n">10</div><div class="l">interactive, cited profiles</div></div>
        <div class="stat"><div class="n">73</div><div class="l">verifiable sources, all link-checked</div></div>
        <div class="stat"><div class="n">44</div><div class="l">licensed media items with rights notes</div></div>
        <div class="stat"><div class="n">1</div><div class="l">click to export for WordPress</div></div>
      </div>
      <h2>Thank you</h2>
      <p class="lead">Immigrant Hall of Honor Virtual Museum · Challenge X<br>Python · FastAPI · React · OpenAI GPT models</p>
    </div>
    <div class="foot"><span>immigranthallofhonor.org</span><span>Every claim cited · every link checked</span></div>`,
};

(async () => {
  const dir = path.join(OUT, "cards");
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const [name, body] of Object.entries(CARDS)) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${body}</body></html>`;
    const file = path.join(dir, `${name}.html`);
    fs.writeFileSync(file, html);
    await page.goto("file://" + file);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    console.log("card", name);
  }
  await browser.close();
})();
