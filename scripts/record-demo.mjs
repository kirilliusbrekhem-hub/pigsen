// Captures clean, already-loaded states of the real Kapital interface for the landing hero video.
// Step 1 of 2 (step 2: scripts/compose-demo.mjs renders the final hero.mp4 from these captures).
//
// Usage (app built and running, Postgres reachable):
//   DATABASE_URL=postgresql://... BASE_URL=http://localhost:3500 node scripts/record-demo.mjs [outDir]
// Prepares a demo account with realistic data (Pro, coins, goals, finished lesson + quiz, community posts,
// a weekly leaderboard of friends), hides every floating element (toasts, popovers, bubbles, prompts) and
// saves crisp PNG stills (deviceScaleFactor 1.5) plus a frame sequence of CAP streaming its answer.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3500";
const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL is required (demo data is prepared directly in the DB)");
const OUT = process.argv[2] ?? "tmp/demo-capture";
mkdirSync(join(OUT, "ai"), { recursive: true });
const THEME = process.env.DEMO_THEME ?? "dark";
const VIEW = { width: 1280, height: 800 };

const sql = (q) => execFileSync("psql", [DB, "-At", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();
const esc = (s) => s.replace(/'/g, "''");
sql(`DELETE FROM "RateHit"`);
// Drop the demo users of previous runs (posts, progress, likes cascade) so the board has no duplicates.
sql(`DELETE FROM "User" WHERE email ~ '^demo[0-9]+-[0-9]+@pigsen\\.test$'`);

const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const stamp = Date.now();

/** Registers a user through the API; returns { id, ctx }. */
async function register(name, i) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1.5, colorScheme: THEME });
  const r = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name, email: `demo${stamp}-${i}@pigsen.test`, password: "supersecret1", accept: true },
  });
  if (!r.ok()) throw new Error(`register ${name}: ${r.status()} ${await r.text()}`);
  const { id } = await r.json();
  sql(`UPDATE "Profile" SET onboarded=true, "proUntil"=now()+interval '30 days', interests='{Finance,Investing,Startups}' WHERE "userId"='${id}'`);
  return { id, ctx };
}

const lessons = sql(`SELECT id FROM "Lesson" ORDER BY id LIMIT 12`).split("\n");
/** Weekly leaderboard points come from lessons completed this week. */
function completeLessons(userId, n) {
  for (const l of lessons.slice(0, n))
    sql(`INSERT INTO "Progress"(id,"userId","lessonId",status,"completedAt","updatedAt") VALUES ('demo${stamp}${userId.slice(-6)}${l.slice(-6)}','${userId}','${l}','completed',now()-interval '1 hour',now()) ON CONFLICT DO NOTHING`);
}
const POSTS = [
  ["Марина К.", "Закрыла цель «Подушка безопасности» — 150 000 ₽ за 8 месяцев. Правило 10% реально работает!", 7],
  ["Артём", "Прошёл курс по инвестициям и открыл ИИС. CAP помог разобраться с налоговым вычетом за 5 минут.", 6],
  ["Соня", "Месяц без спонтанных покупок: +12 400 ₽ в копилку. Кто со мной на челлендж?", 5],
  ["Дима Л.", "Квиз по сложному проценту — 5/5 с первой попытки, +40 XP", 4],
  ["Катя", "Первый доход с фриланса отправила сразу в цель «Ноутбук». Осталось 18%!", 3],
];
const friends = [];
for (const [i, [name, text, n]] of POSTS.entries()) {
  const f = await register(name, i + 1);
  completeLessons(f.id, n);
  sql(`INSERT INTO "CommunityPost"(id,"userId",text,kind,topic,"createdAt") VALUES ('demopost${stamp}${i}','${f.id}','${esc(text)}','win','savings',now()-interval '${(i + 1) * 90} seconds')`);
  friends.push(f);
  await f.ctx.close();
}
// Likes from friends on each other's posts, so the feed looks alive.
for (const [i] of POSTS.entries())
  for (const f of friends.slice(0, 5 - i))
    sql(`INSERT INTO "PostLike"("userId","postId","createdAt") VALUES ('${f.id}','demopost${stamp}${i}',now()) ON CONFLICT DO NOTHING`);

const me = await register("Алина", 0);
completeLessons(me.id, 5);
sql(`UPDATE "Profile" SET coins=2450, xp=1280, streak=12, "bestStreak"=12, "lastActiveDay"=to_char(now(),'YYYY-MM-DD'), "lastActiveAt"=now() WHERE "userId"='${me.id}'`);
const { ctx } = me;
for (const g of [
  { title: "Отпуск на море", why: "Отдохнуть всей семьёй", target: 120000, theme: "plane", initial: 78000 },
  { title: "Новый ноутбук", why: "Для учёбы и фриланса", target: 90000, theme: "laptop", initial: 61000 },
  { title: "Подушка безопасности", why: "Спокойствие", target: 200000, theme: "umbrella", initial: 54000 },
]) {
  const r = await ctx.request.post(`${BASE}/api/savings`, { data: g });
  if (!r.ok()) console.warn("goal", r.status(), await r.text());
}
sql(`INSERT INTO "CommunityPost"(id,"userId",text,kind,topic,"createdAt") VALUES ('demopost${stamp}me','${me.id}','Уже 65% на отпуск! Помогает автоперевод в день зарплаты','win','savings',now()-interval '20 seconds')`);

// Hide everything that floats over the UI and kill motion noise.
const CLEAN_CSS = `
  .dock, .toasts, .toast, [role="dialog"]:not(.quiz *), .sheet-menu, .install-prompt, .cookie, [data-floating], [class*="popover"],
  [class*="install"], [class*="cookie"], [class*="Toast"] { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; cursor: none !important; scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; }
`;
await ctx.addInitScript((css) => {
  const add = () => {
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener("DOMContentLoaded", add);
}, CLEAN_CSS);
await ctx.route("**/api/coins/daily", (r) => r.abort());
const page = await ctx.newPage();

/** Hides any remaining fixed/sticky overlay that is not part of the app shell. */
async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      const shell = el.closest("nav, aside, header, .sidebar, .side, .topbar, .bottom-nav");
      if (!shell && r.width < innerWidth * 0.9) el.style.setProperty("display", "none", "important");
    }
    document.activeElement?.blur?.();
  });
  await page.mouse.move(-10, -10);
}
async function go(path) {
  await page.goto(BASE + path);
  await settle();
}
const scroller = () =>
  page.evaluate(() => {
    const el = [document.querySelector(".main"), document.scrollingElement].find((e) => e && e.scrollHeight > e.clientHeight + 4) ?? document.scrollingElement;
    return el === document.scrollingElement ? null : ".main";
  });
async function scrollTo(y) {
  const sel = await scroller();
  await page.evaluate(({ sel, y }) => ((sel && document.querySelector(sel)) || document.scrollingElement).scrollTo(0, y), { sel, y });
  await page.waitForTimeout(250);
}
/** Scrolls so the element's top lands `offset` px below the viewport top. */
async function scrollToEl(locator, offset = 90) {
  const sel = await scroller();
  await locator.first().evaluate((el, { sel, offset }) => {
    const s = (sel && document.querySelector(sel)) || document.scrollingElement;
    s.scrollTo(0, s.scrollTop + el.getBoundingClientRect().top - offset);
  }, { sel, offset }).catch(() => {});
  await page.waitForTimeout(300);
}
const snap = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const manifest = {};

// 1. CAP: stream an answer, grabbing frames as it types.
await go("/ai");
const input = page.getByLabel("Вопрос для CAP");
// Without a provider key the server answers in demo mode; this question hits its full investing answer.
await page.addStyleTag({ content: ".badge.warn { display: none !important; }" });
await input.fill("Как работает сложный процент и куда вложить первые 10 000 ₽?");
await page.getByRole("button", { name: "Отправить" }).click();
const aiFrames = [];
const t0 = Date.now();
for (let i = 0; i < 400; i++) {
  const f = join("ai", `${String(i).padStart(3, "0")}.png`);
  await page.mouse.move(-10, -10);
  await page.screenshot({ path: join(OUT, f) });
  aiFrames.push({ f, t: Date.now() - t0 });
  if (await page.getByRole("button", { name: "Копировать ответ" }).count()) break;
  await page.waitForTimeout(80);
}
await page.waitForTimeout(500);
await snap("ai-done");
// Back to the question: reset every scrolled container in the chat.
await page.evaluate(() => document.querySelectorAll("*").forEach((el) => el.scrollTop > 0 && (el.scrollTop = 0)));
await page.waitForTimeout(300);
await snap("ai-top");
manifest.ai = aiFrames;

// 2. Lesson + quiz with XP reward.
const lessonPath = "/learn/osnovy-predprinimatelstva/chto-takoe-startap";
await go(lessonPath);
await snap("lesson");
const done = page.getByRole("button", { name: /Отметить как завершённый/ });
if (await done.count()) {
  await done.click();
  await page.waitForTimeout(900);
}
const quiz = page.getByRole("button", { name: "Начать квиз" });
if (await quiz.count()) {
  await quiz.click();
  await page.locator(".quiz-opt").first().waitFor({ timeout: 90_000 });
  await settle();
  await scrollToEl(page.locator(".quiz"), 70);
  await snap("quiz");
  // Answer correctly: the attempt's answer key lives server-side in QuizAttempt.questions.
  const correct = JSON.parse(sql(`SELECT questions FROM "QuizAttempt" WHERE "userId"='${me.id}' ORDER BY "createdAt" DESC LIMIT 1`)).map((q) => q.answer);
  for (let i = 0; i < 8; i++) {
    if (await page.locator(".quiz-score").isVisible()) break;
    await page.locator(".quiz-opt").nth(correct[i] ?? 0).click();
    await page.waitForTimeout(300);
    if (i === 0) {
      await page.mouse.move(-10, -10);
      await snap("quiz-picked");
    }
    await page.locator(".quiz").getByRole("button", { name: /Дальше|Проверить|Результат|Завершить/ }).first().click();
    await page.waitForTimeout(500);
    if (i === 0) {
      await page.mouse.move(-10, -10);
      await snap("quiz-checked");
    }
  }
  await page.waitForTimeout(800);
  await settle();
  await scrollToEl(page.locator(".quiz-score, .quiz").first(), 70);
  await snap("quiz-score");
}

// 3. Savings goals.
await go("/savings");
await snap("savings");
await scrollTo(380);
await snap("savings-2");

// 4. Shop / PigCoin$ (Pro page) + dashboard.
await go("/dashboard");
await snap("dashboard");
await go("/pro");
await snap("pro");
// The shop ("Потратить PigCoin$": boosts and cosmetics) is the end of the page.
await scrollTo(99999);
await page.locator("text=Буст").first().waitFor({ timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(600);
await scrollToEl(page.getByText("Буст", { exact: true }), 150);
await snap("shop");

// 5. Community + leaderboard.
await go("/community");
// The shared dev DB may hold test posts from other runs; keep only this demo's people in the feed.
await page.evaluate((names) => {
  for (const post of document.querySelectorAll('[data-testid="community-post"]'))
    if (!names.some((n) => post.textContent.includes(n))) post.remove();
}, ["Алина", ...POSTS.map((p) => p[0])]);
await snap("community");
await scrollToEl(page.getByText("Уже 65%"), 200);
await snap("community-feed");
await go("/leaderboard");
await snap("leaderboard");

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
await browser.close();
console.log("captured to", OUT, "ai frames:", aiFrames.length);
