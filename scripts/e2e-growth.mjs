// E2E for referrals, reviews, challenges, community, leaderboard, goal images, cron auth.
// Usage: BASE_URL=... DATABASE_URL=... node scripts/e2e-growth.mjs
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
for (const w of [1280, 360]) {
  const p = await (await browser.newContext({ viewport: { width: w, height: 800 } })).newPage();
  p.on("pageerror", (e) => problems.push(`[${w}] pageerror ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && problems.push(`[${w}] HTTP ${r.status()} ${r.url()}`));
  globalThis[`p${w}`] = p;
}
const page = globalThis.p1280;

async function register(p, email, ref) {
  await p.goto(BASE + "/register" + (ref ? `?ref=${ref}` : ""));
  await p.getByLabel("Имя").fill("Тест Рост");
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Пароль").fill("supersecret1");
  await p.getByRole("button", { name: "Зарегистрироваться" }).click();
  await p.waitForURL("**/onboarding");
  await p.getByRole("button", { name: /^Finance/ }).click();
  await p.getByRole("button", { name: /Продолжить/ }).click();
  await p.waitForURL("**/dashboard");
  return prisma.user.findUnique({ where: { email }, include: { profile: true } });
}

const t = Date.now();
const inviter = await register(page, `inv+${t}@pigsen.test`);
const friendPage = globalThis.p360;
const friend = await register(friendPage, `fr+${t}@pigsen.test`, inviter.id);
const ref = await prisma.referral.findUnique({ where: { inviteeId: friend.id } });
if (!ref) problems.push("referral not created");
const fp = await prisma.profile.findUnique({ where: { userId: friend.id } });
if (fp.coins < 200) problems.push(`friend bonus missing: ${fp.coins}`);
const lesson = await prisma.lesson.findFirst({ where: { order: 1, course: { contentItem: { premium: false } } } });
const st = await friendPage.evaluate(async (id) => (await fetch(`/api/lessons/${id}/complete`, { method: "POST" })).status, lesson.id);
const ip = await prisma.profile.findUnique({ where: { userId: inviter.id } });
if (st !== 200 || !ip.proUntil || ip.coins < 500) problems.push(`inviter reward: status ${st}, coins ${ip.coins}, pro ${ip.proUntil}`);
ok("Referral: friend +200, inviter +500 and Pro");
await page.goto(BASE + "/invite");
await page.getByText(/Отзыв за награду/).first().waitFor();

// Review
const rv = await page.evaluate(async () => (await fetch("/api/reviews", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: 5, text: "Очень полезная платформа, копилка реально помогает копить!" }) })).status);
if (rv >= 300) problems.push(`review status ${rv}`);
const review = await prisma.review.findUnique({ where: { userId: inviter.id } });
await prisma.$transaction([prisma.review.update({ where: { id: review.id }, data: {} })]);
ok("Review submitted: " + rv);

// Challenges (inviter is Pro now)
await page.goto(BASE + "/challenges");
await page.waitForLoadState("networkidle");
// Community
await page.goto(BASE + "/community");
const cp = await page.evaluate(async () => (await fetch("/api/community", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Всем привет! Коплю на машину." }) })).status);
if (cp >= 300) problems.push(`community post ${cp}`);
const cf = await friendPage.evaluate(async () => (await fetch("/api/community", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Я free" }) })).status);
if (cf !== 403) problems.push(`free community post ${cf}`);
ok(`Community: Pro ${cp}, Free ${cf}`);
await page.goto(BASE + "/leaderboard");
await page.waitForLoadState("networkidle");
await friendPage.goto(BASE + "/leaderboard");
await friendPage.goto(BASE + "/challenges");
await friendPage.goto(BASE + "/community");
ok("Leaderboard/challenges/community render");

// Goal with image
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const gs = await page.evaluate(async (image) => {
  const r = await fetch("/api/savings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Машина", why: "Свобода", target: 500000, theme: "piggy", initial: 0, image }) });
  return [r.status, await r.text()];
}, png);
if (gs[0] >= 300) problems.push(`goal with image ${gs}`);
await page.goto(BASE + "/savings");
ok("Goal with image: " + gs[0]);

const cron = await fetch(BASE + "/api/cron/push");
if (cron.status !== 401) problems.push(`cron without secret ${cron.status}`);
const sw = await fetch(BASE + "/sw.js", { redirect: "manual" });
if (sw.status !== 200) problems.push(`sw.js ${sw.status}`);
ok(`cron ${cron.status}, sw ${sw.status}`);

for (const [w, p] of [[1280, page], [360, friendPage]]) {
  for (const path of ["/invite", "/challenges", "/community", "/leaderboard", "/savings"]) {
    await p.goto(BASE + path);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll("main *")].some((e) => e.getBoundingClientRect().right > window.innerWidth + 2 && getComputedStyle(e).position !== "fixed"));
    if (over && w === 360) problems.push(`overflow ${path} @${w}`);
  }
}
ok("Layout check");
if (inviter) {
  await page.goto(BASE + "/admin");
}
await browser.close();
await prisma.$disconnect();
if (problems.length) { console.log("\nПроблемы:\n" + problems.join("\n")); process.exit(1); }
console.log("\nВсё чисто");
