// E2E for Pro marketing, free limits, premium content, shop items and coin bonuses.
// Usage: BASE_URL=http://localhost:3000 DATABASE_URL=... node scripts/e2e-pro.mjs
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));

const email = `pro+${Date.now()}@pigsen.test`;
await page.goto(BASE + "/register");
await page.getByLabel("Имя").fill("Пётр Про");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
await page.getByRole("button", { name: "Зарегистрироваться" }).click();
await page.waitForURL("**/onboarding");
await page.getByRole("button", { name: /^Finance/ }).click();
await page.getByRole("button", { name: /Продолжить/ }).click();
await page.waitForURL("**/dashboard");
const user = await prisma.user.findUnique({ where: { email } });

await page.getByTestId("daily-bonus").waitFor();
await page.getByTestId("pro-promo").first().waitFor();
ok("Dashboard: daily bonus and Pro banner");
await page.reload();
if (await page.getByTestId("daily-bonus").count()) problems.push("daily bonus paid twice");

await page.goto(BASE + "/ai");
const q = await page.getByTestId("chat-quota").textContent();
if (!q.includes("7 из 7")) problems.push(`chat quota text: ${q}`);
ok("Chat quota shown: " + q.trim());
// Exhaust chat allowance in the ledger, then the API must refuse
await prisma.coinTx.createMany({ data: Array.from({ length: 7 }, () => ({ userId: user.id, amount: 0, reason: "use:chat" })) });
const conv = await page.evaluate(async () => (await (await fetch("/api/ai/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json()).id);
const st = await page.evaluate(async (id) => (await fetch(`/api/ai/conversations/${id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "Привет, как копить?" }) })).status, conv);
if (st !== 402) problems.push(`chat over limit status ${st}`);
ok("Chat limit enforced: " + st);

// Premium course: lesson 1 open, lesson 2 locked, API refuses
await page.goto(BASE + "/learn/investicii-do-pervogo-portfelya/portfel-risk-i-dohodnost");
if (await page.getByTestId("premium-lock").count()) problems.push("first premium lesson locked");
await page.goto(BASE + "/learn/investicii-do-pervogo-portfelya/portfel-obligacii-i-ofz");
await page.getByTestId("premium-lock").waitFor();
const l2 = await prisma.lesson.findFirst({ where: { slug: "portfel-obligacii-i-ofz" } });
const cs = await page.evaluate(async (id) => (await fetch(`/api/lessons/${id}/complete`, { method: "POST" })).status, l2.id);
if (cs !== 403) problems.push(`locked lesson complete status ${cs}`);
await page.goto(BASE + "/library/oshibki-nachinayushchih-investorov");
await page.getByTestId("premium-lock").waitFor();
ok("Premium content locked for Free");

// Shop: trial for 1000, chest
await prisma.profile.update({ where: { userId: user.id }, data: { coins: 1200 } });
await page.goto(BASE + "/pro");
await page.getByTestId("compare").waitFor();
const card = (t) => page.locator(".shop-item", { hasText: t });
await card("Пробный Pro").getByRole("button").click();
await page.getByText(/Пробный Pro до/).first().waitFor();
await card("Сундук удачи").getByRole("button").click();
await page.getByText(/В сундуке/).waitFor();
const p = await prisma.profile.findUnique({ where: { userId: user.id } });
if (!p.liteUntil || p.liteUntil < new Date()) problems.push("trial not active");
ok(`Shop: trial + chest, coins now ${p.coins}`);
await page.goto(BASE + "/ai");
const q2 = await page.getByTestId("chat-quota").textContent();
if (!q2.includes("из 25")) problems.push(`lite quota ${q2}`);
await page.goto(BASE + "/learn/investicii-do-pervogo-portfelya/portfel-obligacii-i-ofz");
await page.getByTestId("premium-lock").waitFor();
ok("Trial: raised limits, premium still locked");

// Full Pro unlocks everything
await prisma.profile.update({ where: { userId: user.id }, data: { proUntil: new Date(Date.now() + 86_400_000) } });
await page.reload();
if (await page.getByTestId("premium-lock").count()) problems.push("Pro still locked");
await page.goto(BASE + "/ai");
if (await page.getByTestId("chat-quota").count()) problems.push("Pro sees quota");
await page.goto(BASE + "/dashboard");
if (await page.getByTestId("pro-promo").count()) problems.push("Pro sees promo");
ok("Pro: unlocked, no quota, no banners");

await browser.close();
await prisma.$disconnect();
if (problems.length) {
  console.log("\nПроблемы:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nВсё чисто");
