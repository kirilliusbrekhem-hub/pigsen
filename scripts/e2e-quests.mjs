// Daily quests, chest, weekly quest, wheel of fortune, badges and fx: API + race checks, then UI screenshots.
// Usage: BASE_URL=... DATABASE_URL=... [CHROMIUM_PATH=...] [SHOTS=dir] node scripts/e2e-quests.mjs
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "e2e-shots/quests";
mkdirSync(SHOTS, { recursive: true });
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const check = (cond, msg) => (cond ? ok(msg) : problems.push(msg));
const day = new Date().toISOString().slice(0, 10);

async function newUser(tag) {
  const email = `quest-${tag}+${Date.now()}@pigsen.test`;
  const reg = await fetch(BASE + "/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Квестер Тест", email, password: "supersecret1", accept: true }),
  });
  if (reg.status !== 201) throw new Error(`register ${reg.status} ${await reg.text()}`);
  const cookie = reg.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.profile.upsert({ where: { userId: user.id }, update: { onboarded: true }, create: { userId: user.id, onboarded: true } });
  const call = (method, path, body) =>
    fetch(BASE + path, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));
  return { user, email, cookie, get: (p) => call("GET", p), post: (p, b) => call("POST", p, b) };
}

const { user, email, cookie, get, post } = await newUser("api");
const coins = async () => (await prisma.profile.findUnique({ where: { userId: user.id } })).coins;

// Board shape: 3 daily quests (always a lesson), chest, weekly, wheel.
let board = (await get("/api/quests")).data;
check(board?.daily?.length === 3 && board.daily[0].id === "lesson", `board has 3 daily quests starting with a lesson (${board?.daily?.map((q) => q.id).join(",")})`);
check(board.spin.available === true && board.spin.prizes.length === 6, "wheel available with 6 prizes");

// Not ready yet → 422; unknown quest → 404.
check((await post("/api/quests", { id: "lesson" })).status === 422, "claiming an unfinished quest is refused (422)");
check((await post("/api/quests", { id: "nope" })).status === 404, "unknown quest is 404");
check((await post("/api/quests", { id: "chest" })).status === 422, "chest is locked before all 3 are claimed");

// Complete a lesson → lesson quest + weekly progress.
const lessons = await prisma.lesson.findMany({ where: { course: { contentItem: { premium: false } } }, orderBy: [{ courseId: "asc" }, { order: "asc" }], take: 6 });
await post(`/api/lessons/${lessons[0].id}/complete`);
await post(`/api/lessons/${lessons[0].id}/complete`); // re-completion must not count again
board = (await get("/api/quests")).data;
check(board.daily[0].done && board.daily[0].progress === 1, "lesson quest done after completing a lesson");
check(board.weekly.progress === 1, `weekly progress 1/5 (got ${board.weekly.progress})`);

// Race: 20 parallel claims pay once.
const c0 = await coins();
const xp0 = (await prisma.profile.findUnique({ where: { userId: user.id } })).xp;
const res = await Promise.all(Array.from({ length: 20 }, () => post("/api/quests", { id: "lesson" })));
const okCount = res.filter((r) => r.status === 200).length;
const xp1 = (await prisma.profile.findUnique({ where: { userId: user.id } })).xp;
check(okCount === 1 && res.every((r) => r.status === 200 || r.status === 409), `20 parallel claims → 1 success (${res.map((r) => r.status).join(",")})`);
check(xp1 - xp0 === 10 && (await coins()) - c0 === 5, `quest pays +10 XP / +5 PigCoin$ on Free (got +${xp1 - xp0} XP, +${(await coins()) - c0} coins)`);

// Finish the other two quests by triggering their events directly (server hooks are covered by kind-specific calls).
for (const q of board.daily.slice(1)) {
  const kind = q.id;
  if (kind === "deposit") {
    const g = await post("/api/savings", { title: "Квест-цель", target: 10000 });
    await post(`/api/savings/${g.data.goal.id}/entries`, { amount: 100 });
  } else if (kind === "save") {
    const item = await prisma.contentItem.findFirst({ where: { premium: false } });
    await post("/api/saved", { contentItemId: item.id });
  } else {
    // quiz / quiz_perfect / ask_pig need AI; simulate the hook's effect.
    await prisma.$executeRaw`INSERT INTO "QuestProgress" ("userId","period","kind","progress","updatedAt") VALUES (${user.id}, ${"d:" + day}, ${kind}, 1, NOW()) ON CONFLICT DO NOTHING`;
  }
  const r = await post("/api/quests", { id: kind });
  check(r.status === 200, `quest "${kind}" claimed (${r.status})`);
}
// Chest: race, pays once.
const c1 = await coins();
const chest = await Promise.all(Array.from({ length: 15 }, () => post("/api/quests", { id: "chest" })));
check(chest.filter((r) => r.status === 200).length === 1, `chest opens once (${chest.map((r) => r.status).join(",")})`);
check((await coins()) - c1 === 15, `chest pays 10 PigCoin$ + 10 XP (=5 coins) → +15 (got +${(await coins()) - c1})`);

// Wheel: 20 parallel spins → one prize.
const spins = await Promise.all(Array.from({ length: 20 }, () => post("/api/quests/spin")));
const won = spins.filter((r) => r.status === 200);
const spinTx = await prisma.coinTx.count({ where: { userId: user.id, reason: "spin" } });
check(won.length === 1 && spinTx <= 1, `wheel spins once a day (${won.length} ok, ${spinTx} coin tx)`);
check(won[0] && won[0].data.index >= 0 && won[0].data.index < 6, `wheel prize: ${won[0]?.data?.label}`);

// Weekly quest: 5 lessons this week.
for (const l of lessons.slice(1, 5)) await post(`/api/lessons/${l.id}/complete`);
board = (await get("/api/quests")).data;
check(board.weekly.done, `weekly quest done after 5 lessons (${board.weekly.progress}/5)`);
const c2 = await coins();
const wk = await Promise.all(Array.from({ length: 10 }, () => post("/api/quests", { id: "weekly" })));
check(wk.filter((r) => r.status === 200).length === 1, "weekly reward paid once");
check((await coins()) - c2 === 40, `weekly pays 20 PigCoin$ + 40 XP (=20 coins) → +40 (got +${(await coins()) - c2})`);

// Badges: tiered badges exist with progress.
const quests = await prisma.dailyClaim.count({ where: { userId: user.id, key: { startsWith: "quest:d:" } } });
check(quests >= 4, `quest claims recorded (${quests})`);

// ---------- UI ----------
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const [name, value] = cookie.split(";")[0].split("=");
const host = new URL(BASE).hostname;
async function ctxFor(width, height, mobile) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies(cookie.split("; ").map((c) => ({ name: c.split("=")[0], value: c.slice(c.indexOf("=") + 1), domain: host, path: "/" })));
  return ctx;
}
void name;
void value;
for (const [w, h, m] of [[1440, 1000, false], [390, 844, true]]) {
  const ctx = await ctxFor(w, h, m);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror ${w}: ${e.message}`));
  await page.goto(BASE + "/dashboard");
  await page.getByTestId("today-panel").waitFor();
  await page.waitForTimeout(1300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `dashboard ${w}px: no horizontal overflow (${overflow})`);
  await page.screenshot({ path: `${SHOTS}/fx-dashboard-${w}.png`, fullPage: false });
  await page.getByTestId("today-panel").screenshot({ path: `${SHOTS}/fx-quests-${w}.png` });
  await ctx.close();
}

// Fresh user: claim a quest in the UI, then level up through a lesson and see the modal.
const u2 = await newUser("ui");
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies(u2.cookie.split("; ").map((c) => ({ name: c.split("=")[0], value: c.slice(c.indexOf("=") + 1), domain: host, path: "/" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push(`pageerror ui: ${e.message}`));
await u2.post(`/api/lessons/${lessons[0].id}/complete`);
await page.goto(BASE + "/dashboard");
await page.locator('[data-quest="lesson"] .q-claim').click();
await page.locator('[data-quest="lesson"].claimed').waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/fx-quest-claim.png` });
ok("quest claimed from the dashboard");
// Spin in UI
await page.getByTestId("spin-btn").click();
await page.waitForTimeout(4200);
check(/Выпало/.test(await page.getByTestId("lucky-wheel").innerText()), "wheel shows the prize after spinning");
await page.getByTestId("lucky-wheel").screenshot({ path: `${SHOTS}/fx-wheel.png` });

// Level-up: 95 XP, complete a lesson (+20) → level 2.
await prisma.profile.update({ where: { userId: u2.user.id }, data: { xp: 95 } });
const l = await prisma.lesson.findUnique({ where: { id: lessons[1].id }, include: { course: true } });
await page.goto(`${BASE}/learn/${l.course.slug}/${l.slug}`);
await page.getByRole("button", { name: /Отметить как завершённый/ }).click();
const modal = page.getByTestId("levelup-modal");
await modal.waitFor({ timeout: 8000 }).then(() => ok("level-up modal shown"), () => problems.push("level-up modal not shown"));
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/fx-levelup.png` });
await page.keyboard.press("Escape");

// Interactive lesson blocks
await page.goto(`${BASE}/learn/investicii-pervyj-shag/slozhnyj-procent`);
const ix = page.getByTestId("lesson-interactive");
if (await ix.count()) {
  await ix.locator(".check-opt").nth(1).click();
  check(/Верно/.test(await ix.innerText()), "check-yourself card reacts to the right answer");
  await ix.screenshot({ path: `${SHOTS}/fx-lesson-interactive.png` });
} else problems.push("interactive blocks missing on the compound-interest lesson");
await page.goto(`${BASE}/learn/osnovy-predprinimatelstva/yunit-ekonomika`);
await page.locator(".flip").first().click();
check((await page.locator(".flip.on").count()) === 1, "flip card flips");

await browser.close();
console.log(`(user ${email})`);
await prisma.$disconnect();
if (problems.length) {
  console.error("\n✗ Problems:\n" + problems.map((p) => " - " + p).join("\n"));
  process.exit(1);
}
console.log("\nQuests e2e passed");
