// Step 2 of 2: composes the landing hero video from the stills captured by scripts/record-demo.mjs.
// The whole timeline (camera moves, transitions, captions, intro/outro cards) is a pure function of time
// rendered in a headless page in the app font (Geist), screenshotted frame by frame, then encoded by ffmpeg.
//
// Usage: node scripts/compose-demo.mjs <captureDir>
// Output: public/landing/hero.mp4 (h264, yuv420p, faststart, no audio) + public/landing/hero-poster.webp
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CAP = resolve(process.argv[2] ?? "tmp/demo-capture");
const OUT = "public/landing";
const W = 1280;
const H = 800;
const FPS = 30;
const ENC_W = Number(process.env.HERO_WIDTH ?? 1280);
const FONTS = "node_modules/geist/dist/fonts";

for (const [src, dst] of [
  [`${FONTS}/geist-sans/Geist-Regular.woff2`, "g-400.woff2"],
  [`${FONTS}/geist-sans/Geist-Medium.woff2`, "g-500.woff2"],
  [`${FONTS}/geist-sans/Geist-SemiBold.woff2`, "g-600.woff2"],
  [`${FONTS}/geist-mono/GeistMono-Regular.woff2`, "gm-400.woff2"],
  ["public/pig.png", "pig.png"],
])
  copyFileSync(src, join(CAP, dst));

// Brand tokens (app/prototype.css, dark theme): black + green + white only.
const C = { bg: "#090C0D", ink: "#ECEFEC", ink2: "#A3ADA9", accent: "#3FBD88", accentHi: "#55CC99", line: "#1E4636" };

/**
 * Scenes. Times in seconds. Each shot shows one still with a camera move: z = zoom, (x, y) = focus point
 * in image fractions. `reveal` uncovers the image top-down over a base still (the CAP answer "typing").
 */
const SCENES = [
  { kind: "intro", t0: 0, t1: 2.3 },
  {
    t0: 2.0, t1: 6.6, n: "01", tag: "CAP", title: ["CAP ответит на любой", { g: "вопрос о деньгах" }],
    shots: [
      { img: "ai/000.png", t0: 2.0, t1: 3.1, from: { z: 1.32, x: 0.47, y: 0.27 }, to: { z: 1.38, x: 0.47, y: 0.28 } },
      { img: "ai-top.png", under: "ai/000.png", reveal: [3.0, 4.7, 0.21, 0.83], t0: 3.0, t1: 6.6, from: { z: 1.38, x: 0.47, y: 0.29 }, to: { z: 1.5, x: 0.47, y: 0.52 } },
    ],
  },
  {
    t0: 6.3, t1: 10.9, n: "02", tag: "Обучение", title: ["Уроки по 5 минут", { g: "+ квизы" }],
    shots: [
      { img: "quiz-picked.png", t0: 6.3, t1: 8.2, from: { z: 1.22, x: 0.47, y: 0.45 }, to: { z: 1.4, x: 0.47, y: 0.4 } },
      { img: "quiz-score.png", t0: 8.0, t1: 10.9, from: { z: 1.3, x: 0.42, y: 0.32 }, to: { z: 1.75, x: 0.34, y: 0.25 } },
    ],
  },
  {
    t0: 10.6, t1: 14.6, n: "03", tag: "Копилка", title: ["Копилка", { g: "с целями" }],
    shots: [
      { img: "savings.png", t0: 10.6, t1: 14.6, from: { z: 1.08, x: 0.6, y: 0.42 }, to: { z: 1.42, x: 0.62, y: 0.66 } },
    ],
  },
  {
    t0: 14.3, t1: 18.4, n: "04", tag: "PigCoin$", title: [{ g: "PigCoin$" }, "за каждый шаг"],
    shots: [
      { img: "pro.png", t0: 14.3, t1: 16.3, from: { z: 1.45, x: 0.79, y: 0.38 }, to: { z: 1.7, x: 0.78, y: 0.37 } },
      { img: "shop.png", t0: 16.1, t1: 18.4, from: { z: 1.2, x: 0.5, y: 0.3 }, to: { z: 1.35, x: 0.56, y: 0.42 } },
    ],
  },
  {
    t0: 18.1, t1: 22.6, n: "05", tag: "Pro", title: ["Комьюнити", { g: "и лидерборд" }],
    shots: [
      { img: "community-feed.png", t0: 18.1, t1: 20.2, from: { z: 1.3, x: 0.55, y: 0.38 }, to: { z: 1.36, x: 0.55, y: 0.6 } },
      { img: "leaderboard.png", t0: 20.0, t1: 22.6, from: { z: 1.25, x: 0.6, y: 0.62 }, to: { z: 1.45, x: 0.6, y: 0.7 } },
    ],
  },
  { kind: "outro", t0: 22.3, t1: 25.5 },
];
const DUR = 25.5;
const XF = 0.3; // crossfade between shots / scenes

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: G; src: url(g-400.woff2); font-weight: 400; }
@font-face { font-family: G; src: url(g-500.woff2); font-weight: 500; }
@font-face { font-family: G; src: url(g-600.woff2); font-weight: 600; }
@font-face { font-family: GM; src: url(gm-400.woff2); font-weight: 400; }
* { margin: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.bg}; font-family: G, sans-serif; color: ${C.ink}; }
.layer { position: absolute; inset: 0; overflow: hidden; will-change: opacity, filter; }
.layer img { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
.scrim { position: absolute; inset: 0; background: linear-gradient(to top, rgba(4,7,8,.94) 0%, rgba(4,7,8,.78) 22%, rgba(4,7,8,0) 50%); pointer-events: none; }
.cap { position: absolute; left: 64px; bottom: 58px; }
.cap .tag { font-family: GM, monospace; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: ${C.accent}; display: flex; gap: 12px; align-items: center; }
.cap .tag i { display: block; height: 2px; background: ${C.accent}; border-radius: 2px; }
.cap h2 { margin-top: 14px; font-size: 52px; line-height: 1.04; font-weight: 600; letter-spacing: -.035em; max-width: 900px; }
.cap h2 span { display: inline-block; margin-right: .24em; }
.cap h2 .g { color: ${C.accent}; }
.card { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; background: radial-gradient(60% 70% at 50% 45%, #0f2a1f 0%, ${C.bg} 70%); }
.card .wrap { display: flex; flex-direction: column; align-items: center; }
.card img { position: static; transform-origin: 50% 50%; width: 132px; height: 132px; object-fit: contain; filter: brightness(0) invert(1) drop-shadow(0 16px 36px rgba(63,189,136,.45)); }
.card .word { margin-top: 18px; font-size: 64px; font-weight: 600; letter-spacing: -.04em; }
.card .word b { color: ${C.accent}; font-weight: 600; }
.card .sub { margin-top: 8px; font-size: 30px; font-weight: 500; letter-spacing: -.02em; color: ${C.ink2}; }
.card .sub b { color: ${C.ink}; font-weight: 500; }
.btn { margin-top: 34px; padding: 18px 34px; border-radius: 999px; background: ${C.accent}; color: #04170F; font-size: 26px; font-weight: 600; letter-spacing: -.02em; box-shadow: 0 0 0 0 rgba(63,189,136,.5); }
.url { margin-top: 18px; font-family: GM, monospace; font-size: 16px; letter-spacing: .1em; color: ${C.ink2}; }
.sweep { position: absolute; top: 0; bottom: 0; width: 220px; background: linear-gradient(90deg, rgba(63,189,136,0), rgba(63,189,136,.16), rgba(63,189,136,0)); pointer-events: none; }
</style></head><body><div id="stage"></div><script>
const SCENES = ${JSON.stringify(SCENES)}, W = ${W}, H = ${H}, XF = ${XF};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const out = (k) => 1 - Math.pow(1 - k, 3);
const back = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const stage = document.getElementById("stage");
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// Build DOM once.
for (const s of SCENES) {
  if (s.kind) {
    const L = el("div", "layer"); s.el = L;
    const card = el("div", "card"); const wrap = el("div", "wrap");
    s.logo = el("img"); s.logo.src = "pig.png"; wrap.append(s.logo);
    s.word = el("div", "word", "PIG<b>$</b>EN"); wrap.append(s.word);
    s.sub = el("div", "sub", "Make your money <b>Smarter.</b>"); wrap.append(s.sub);
    if (s.kind === "outro") { s.btn = el("div", "btn", "Начни бесплатно"); wrap.append(s.btn); }
    card.append(wrap); L.append(card); stage.append(L); continue;
  }
  s.el = el("div", "layer");
  for (const sh of s.shots) {
    sh.el = el("div", "layer");
    if (sh.under) { sh.u = el("img"); sh.u.src = sh.under; sh.el.append(sh.u); }
    sh.i = el("img"); sh.i.src = sh.img; sh.el.append(sh.i);
    s.el.append(sh.el);
  }
  s.el.append(el("div", "scrim"));
  s.sweep = el("div", "sweep"); s.el.append(s.sweep);
  const cap = el("div", "cap");
  s.tagEl = el("div", "tag"); s.bar = el("i"); s.tagEl.append(el("span", "", s.n + " · " + s.tag), s.bar);
  const h = el("h2");
  s.words = [];
  for (const part of s.title) {
    const green = typeof part === "object"; const text = green ? part.g : part;
    for (const w of green ? [text.replace(/ /g, "\u00a0")] : text.split(" ")) { const sp = el("span", green ? "g" : "", w); h.append(sp); s.words.push(sp); }
  }
  cap.append(s.tagEl, h); s.cap = cap; s.el.append(cap); stage.append(s.el);
}

function camera(img, c) {
  // Keep the frame inside the screenshot: clamp the focus so no edge shows.
  const z = c.z, hw = .5 / z;
  const x = clamp(c.x, hw, 1 - hw), y = clamp(c.y, hw, 1 - hw);
  img.style.transform = "translate(" + (W / 2 - x * W * z) + "px," + (H / 2 - y * H * z) + "px) scale(" + z + ")";
}
const fade = (t, t0, t1) => clamp((t - t0) / XF) * clamp((t1 - t) / XF);

window.render = (t) => {
  for (const s of SCENES) {
    const a = s.t0 === 0 ? clamp((s.t1 - t) / XF) : fade(t, s.t0, s.t1);
    const last = s.kind === "outro";
    const vis = last ? clamp((t - s.t0) / XF) : a;
    s.el.style.opacity = vis;
    s.el.style.display = vis > 0 ? "block" : "none";
    if (vis <= 0) continue;
    const k = clamp((t - s.t0) / (s.t1 - s.t0));
    if (s.kind) {
      const lt = t - s.t0 - (s.kind === "outro" ? .15 : .1);
      const p = (d, dur = .55) => clamp((lt - d) / dur);
      s.logo.style.transform = "scale(" + lerp(.6, 1, back(p(0, .6))) + ")";
      s.logo.style.opacity = p(0, .3);
      s.word.style.opacity = p(.2); s.word.style.transform = "translateY(" + lerp(18, 0, out(p(.2))) + "px)";
      s.sub.style.opacity = p(.38); s.sub.style.transform = "translateY(" + lerp(18, 0, out(p(.38))) + "px)";
      if (s.btn) {
        s.btn.style.opacity = p(.6); s.btn.style.transform = "translateY(" + lerp(18, 0, out(p(.6))) + "px) scale(" + (1 + .03 * Math.sin(Math.max(0, lt - 1.2) * 5)) + ")";
        s.btn.style.boxShadow = "0 0 0 " + (14 * ((Math.max(0, lt - 1.2) * .8) % 1)) + "px rgba(63,189,136," + (.45 * (1 - ((Math.max(0, lt - 1.2) * .8) % 1))) + ")";
      }
      // Outro fades back to the intro's first frame (plain background) so the loop is seamless.
      if (last) s.el.style.opacity = vis * clamp((DUR - t) / .45);
      // Intro: start already from the plain background (matches the outro's last frame).
      continue;
    }
    // Scene entry: slight zoom-in + blur clearing.
    const ent = out(clamp((t - s.t0) / .5));
    s.el.style.filter = ent < 1 ? "blur(" + (1 - ent) * 8 + "px)" : "none";
    for (const sh of s.shots) {
      const first = sh === s.shots[0], lastShot = sh === s.shots[s.shots.length - 1];
      let o = 1;
      if (!first) o *= clamp((t - sh.t0) / XF);
      if (!lastShot) o *= clamp((sh.t1 - t) / XF) ;
      sh.el.style.opacity = (t >= sh.t0 - .001 && t <= sh.t1 + .001) ? o : 0;
      const sk = ease(clamp((t - sh.t0) / (sh.t1 - sh.t0)));
      const c = { z: lerp(sh.from.z, sh.to.z, sk), x: lerp(sh.from.x, sh.to.x, sk), y: lerp(sh.from.y, sh.to.y, sk) };
      // Shot entry punch: a touch of extra zoom settling in.
      const pin = out(clamp((t - sh.t0) / .6));
      c.z *= 1 + .05 * (1 - pin);
      camera(sh.i, c); if (sh.u) camera(sh.u, c);
      if (sh.reveal) {
        const [r0, r1, y0, y1] = sh.reveal;
        const rk = clamp((t - r0) / (r1 - r0));
        const y = lerp(y0, y1, rk) * 100;
        const m = rk >= 1 ? "none" : "linear-gradient(to bottom, #000 0%, #000 " + y + "%, transparent " + (y + 4) + "%)";
        sh.i.style.webkitMaskImage = m; sh.i.style.maskImage = m;
      }
    }
    // Caption: tag + per-word rise.
    const ct = t - s.t0 - .2;
    const ta = clamp(ct / .35);
    s.tagEl.style.opacity = ta; s.tagEl.style.transform = "translateX(" + lerp(-16, 0, out(ta)) + "px)";
    s.bar.style.width = (8 + 120 * clamp((t - s.t0) / (s.t1 - s.t0 - XF))) + "px";
    s.words.forEach((w, i) => {
      const wk = clamp((ct - .08 - i * .07) / .45);
      w.style.opacity = wk; w.style.transform = "translateY(" + lerp(26, 0, out(wk)) + "px)";
      w.style.filter = wk < 1 ? "blur(" + (1 - wk) * 6 + "px)" : "none";
    });
    // Green light sweep across the frame on scene entry.
    const sw = clamp((t - s.t0) / .7);
    s.sweep.style.opacity = sw > 0 && sw < 1 ? Math.sin(sw * Math.PI) : 0;
    s.sweep.style.transform = "translateX(" + lerp(-260, W + 40, out(sw)) + "px) skewX(-12deg)";
  }
};
const DUR = ${DUR};
</script></body></html>`;
writeFileSync(join(CAP, "compose.html"), html);

const FR = join(CAP, "frames");
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto("file://" + join(CAP, "compose.html"));
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
// PREVIEW="1.2,9.6": render only those times as preview-<t>.png into the capture dir and stop.
if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: join(CAP, `preview-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}
const N = Math.round(DUR * FPS);
for (let f = 0; f < N; f++) {
  await page.evaluate((t) => window.render(t), f / FPS);
  await page.screenshot({ path: join(FR, `${String(f).padStart(4, "0")}.png`) });
}
await browser.close();

const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const mp4 = `${OUT}/hero.mp4`;
const vf = `scale=${ENC_W}:-2:flags=lanczos,format=yuv420p`;
const BITRATE = process.env.HERO_KBPS ?? "430";
const common = ["-framerate", String(FPS), "-i", join(FR, "%04d.png"), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-b:v", `${BITRATE}k`, "-maxrate", `${BITRATE * 2}k`, "-bufsize", `${BITRATE * 4}k`, "-g", String(FPS * 4), "-pix_fmt", "yuv420p"];
const pass = join(CAP, "x264pass");
ff([...common, "-pass", "1", "-passlogfile", pass, "-f", "mp4", "/dev/null"]);
ff([...common, "-pass", "2", "-passlogfile", pass, "-movflags", "+faststart", mp4]);
// Poster: the quiz result with its XP reward is the strongest single frame.
const posterAt = Number(process.env.HERO_POSTER_T ?? 9.6);
ff(["-i", join(FR, `${String(Math.round(posterAt * FPS)).padStart(4, "0")}.png`), "-vf", `scale=${ENC_W}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "62", "-compression_level", "6", `${OUT}/hero-poster.webp`]);
for (const f of [mp4, `${OUT}/hero-poster.webp`]) console.log(f, `${(statSync(f).size / 1024).toFixed(0)} KB`);
