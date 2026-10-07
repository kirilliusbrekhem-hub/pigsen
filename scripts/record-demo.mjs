// Records the landing-page demo videos of the real PIGSEN interface (Playwright recordVideo + ffmpeg).
// Usage: npm run build && npx next start -p 3200, then:
//   BASE_URL=http://localhost:3200 node scripts/record-demo.mjs
// Output: public/landing/demo.mp4, demo.webm, demo-poster.jpg, demo-mobile.mp4
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = "public/landing";
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "pigsen-demo-"));

const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

/** Registers + onboards a fresh user without consuming the daily bonus; returns storage state. */
async function setupUser(viewport) {
  const ctx = await browser.newContext({ viewport, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.route("**/api/coins/daily", (r) => r.abort());
  await go(page, "/register");
  await page.getByLabel("Имя").fill("Алина");
  await page.getByLabel("Email").fill(`demo+${Date.now()}${viewport.width}@pigsen.test`);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/onboarding");
  for (const n of ["Startups", "Finance", "Investing"]) {
    const b = page.getByRole("button", { name: new RegExp(`^${n}`) });
    if (await b.count()) await b.first().click();
  }
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.waitForURL("**/dashboard");
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

const pause = (page, ms) => page.waitForTimeout(ms);
/** Navigates and waits for hydration so typed input is not lost. */
async function go(page, path) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Smoothly scrolls the app's scroll container (or the window) by dy over ~ms. */
async function glide(page, dy, ms = 1400) {
  await page.evaluate(
    async ({ dy, ms }) => {
      const el = [document.querySelector(".main"), document.scrollingElement].find((e) => e && e.scrollHeight > e.clientHeight + 4) ?? document.scrollingElement;
      const from = el.scrollTop;
      const t0 = performance.now();
      await new Promise((done) => {
        const step = (t) => {
          const k = Math.min(1, (t - t0) / ms);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          el.scrollTop = from + dy * e;
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    },
    { dy, ms },
  );
}

async function hover(page, locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
}

/** Feature screenshots for the landing showcase (desktop pass only). */
async function shot(page, mobile, name) {
  if (mobile) return;
  await page.screenshot({ path: `${OUT}/shot-${name}.jpg`, type: "jpeg", quality: 72 });
}

async function tour(page, mobile) {
  // 1. Dashboard with the daily bonus
  await go(page, "/dashboard");
  await page.getByTestId("daily-bonus").waitFor({ timeout: 15_000 }).catch(() => {});
  await pause(page, 1800);
  await shot(page, mobile, "dashboard");
  await glide(page, mobile ? 700 : 420, 1800);
  await pause(page, 900);

  // 2. $PIG chat
  await go(page, "/ai");
  await pause(page, 700);
  const input = page.getByLabel("Вопрос для $PIG");
  await input.click();
  const question = "Как начать откладывать 10% зарплаты?";
  await input.pressSequentially(question, { delay: 45 });
  await pause(page, 300);
  if (await page.getByRole("button", { name: "Отправить" }).isDisabled()) await input.fill(question);
  await page.getByRole("button", { name: "Отправить" }).click();
  await page.getByRole("button", { name: "Копировать ответ" }).waitFor({ timeout: 90_000 });
  await pause(page, 900);
  await shot(page, mobile, "ai");
  await glide(page, mobile ? 600 : 400, 1600);
  await pause(page, 900);

  // 3. Lesson + quiz
  await go(page, "/learn/osnovy-predprinimatelstva/chto-takoe-startap");
  await pause(page, 1000);
  await glide(page, mobile ? 900 : 500, 1800);
  const done = page.getByRole("button", { name: /Отметить как завершённый/ });
  if (await done.count()) {
    await done.scrollIntoViewIfNeeded();
    await hover(page, done);
    await done.click();
    await pause(page, 900);
  }
  const quiz = page.getByRole("button", { name: "Начать квиз" });
  if (await quiz.count()) {
    await quiz.scrollIntoViewIfNeeded();
    await hover(page, quiz);
    await quiz.click();
    await page.locator(".quiz-opt").first().waitFor({ timeout: 60_000 });
    for (let i = 0; i < 3; i++) {
      if (await page.locator(".quiz-score").isVisible()) break;
      const opt = page.locator(".quiz-opt").nth(1);
      await opt.scrollIntoViewIfNeeded();
      await hover(page, opt);
      await opt.click();
      await pause(page, 500);
      await page.locator(".quiz").getByRole("button", { name: /Дальше|Проверить/ }).click();
      await pause(page, 700);
      if (i === 0) await shot(page, mobile, "quiz");
    }
  }

  // 4. Savings goal with progress
  await go(page, "/savings");
  await page.getByText("На что копим?").waitFor();
  await pause(page, 500);
  await page.getByLabel("Цель").pressSequentially("Отпуск на море", { delay: 40 });
  await page.getByLabel("Сколько нужно, ₽").fill("100000");
  await page.getByLabel("Уже есть, ₽").fill("20000");
  const why = page.getByLabel("Зачем это мне (поможет не сорваться)");
  if (await why.count()) await why.fill("Отдохнуть всей семьёй");
  const travel = page.getByRole("button", { name: /Путешествие/ });
  if (await travel.count()) {
    await travel.scrollIntoViewIfNeeded();
    await travel.click();
  }
  const create = page.getByRole("button", { name: "Создать цель" });
  await create.scrollIntoViewIfNeeded();
  await hover(page, create);
  await create.click();
  await page.getByRole("heading", { name: "Отпуск на море" }).waitFor();
  await pause(page, 1000);
  const plus = page.getByRole("button", { name: /\+5\s?000/ });
  if (await plus.count()) {
    await plus.first().scrollIntoViewIfNeeded();
    await hover(page, plus.first());
    await plus.first().click();
    await pause(page, 1600);
  }
  await shot(page, mobile, "savings");

  // 4b. Challenges (screenshot only, not part of the video's highlight)
  if (!mobile) {
    await go(page, "/challenges");
    await pause(page, 1000);
    await shot(page, mobile, "challenges");
  }

  // 5. Shop / Pro
  await go(page, "/pro");
  await pause(page, 1200);
  const shopEl = page.getByText(/Магазин/).first();
  if (await shopEl.count()) {
    await shopEl.scrollIntoViewIfNeeded().catch(() => {});
    await pause(page, 500);
    await shot(page, mobile, "shop");
    await page.evaluate(() => (document.querySelector(".main") ?? document.scrollingElement).scrollTo(0, 0));
  }
  await glide(page, mobile ? 1100 : 700, 2200);
  await pause(page, 800);

  // 6. Community feed
  await go(page, "/community");
  await pause(page, 1200);
  await shot(page, mobile, "community");
  await glide(page, mobile ? 800 : 500, 2000);
  await pause(page, 1200);
}

async function record(viewport, mobile) {
  const state = await setupUser(viewport);
  const dir = join(tmp, mobile ? "m" : "d");
  const ctx = await browser.newContext({
    viewport,
    storageState: state,
    colorScheme: "light",
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    recordVideo: { dir, size: viewport },
  });
  const page = await ctx.newPage();
  await tour(page, mobile);
  await ctx.close();
  const file = readdirSync(dir).find((f) => f.endsWith(".webm"));
  return join(dir, file);
}

function ff(args) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
}
const size = (f) => `${(statSync(f).size / 1024 / 1024).toFixed(2)} MB`;

// The first second is usually a blank page; skip it and speed long waits slightly.
const desk = await record({ width: 1280, height: 800 }, false);
const mob = await record({ width: 390, height: 844 }, true);
await browser.close();

const SPEED = process.env.DEMO_SPEED ?? "1.15";
const vf = (w) => `setpts=PTS/${SPEED},scale=${w}:-2:flags=lanczos,fps=30`;
ff(["-ss", "0.8", "-i", desk, "-an", "-vf", vf(1280), "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/demo.mp4`]);
ff(["-ss", "0.8", "-i", desk, "-an", "-vf", vf(1280), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", `${OUT}/demo.webm`]);
ff(["-ss", "2.5", "-i", `${OUT}/demo.mp4`, "-frames:v", "1", "-q:v", "4", `${OUT}/demo-poster.jpg`]);
ff(["-ss", "0.8", "-i", mob, "-an", "-vf", vf(390), "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/demo-mobile.mp4`]);
ff(["-ss", "2.5", "-i", `${OUT}/demo-mobile.mp4`, "-frames:v", "1", "-q:v", "4", `${OUT}/demo-mobile-poster.jpg`]);
// Feature screenshots: downscale to 1200px wide and recompress.
for (const f of readdirSync(OUT).filter((f) => f.startsWith("shot-") && f.endsWith(".jpg") && !f.endsWith(".min.jpg"))) {
  const src = `${OUT}/${f}`;
  const dst = `${OUT}/${f.replace(".jpg", ".webp")}`;
  ff(["-i", src, "-vf", "scale=1200:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "72", dst]);
  rmSync(src);
}
rmSync(tmp, { recursive: true, force: true });

for (const f of ["demo.mp4", "demo.webm", "demo-poster.jpg", "demo-mobile.mp4", "demo-mobile-poster.jpg"]) console.log(f, size(`${OUT}/${f}`));
