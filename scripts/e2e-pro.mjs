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
page.on("response", (r) => r.status() >= 500 && !(r.status() === 503 && r.url().endsWith("/api/coins/stars")) && problems.push(`HTTP ${r.status()} ${r.url()}`));

const email = `pro+${Date.now()}@pigsen.test`;
await page.goto(BASE + "/register");
await page.getByLabel("Имя").fill("Пётр Про");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
await page.getByRole("button", { name: "Зарегистрироваться" }).click();
await page.waitForURL("**/new");
  await page.goto(BASE + "/dashboard");
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
const card = (id) => page.locator(`.shop-item[data-item="${id}"]`);
await card("pro-trial").getByRole("button").click();
await page.getByText(/Пробный Pro до/).first().waitFor();
await card("chest").getByRole("button").click();
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

// New shop items with real effects
await prisma.profile.update({ where: { userId: user.id }, data: { coins: 6000 } });
await page.goto(BASE + "/pro");
await page.getByTestId("shop-balance").waitFor();
for (const cat of ["Буст", "Доступ", "Стиль"]) if (!(await page.getByRole("heading", { name: cat, exact: true }).count())) problems.push(`shop category ${cat} missing`);
const buy = async (id) => {
  const r = await page.evaluate(async (itemId) => { const res = await fetch("/api/shop/buy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId }) }); return { status: res.status, body: await res.json() }; }, id);
  if (r.status !== 200) problems.push(`buy ${id}: ${r.status} ${JSON.stringify(r.body)}`);
  return r;
};
await card("xp-boost").getByRole("button").click();
await page.getByText(/Двойной XP до/).first().waitFor();
for (const id of ["goal-slot", "pro-pass", "boost-chat-30", "name-gold", "ring-fire", "title-oracle"]) await buy(id);
let pp = await prisma.profile.findUnique({ where: { userId: user.id } });
if (!(pp.xpBoostUntil > new Date())) problems.push("xp boost not active");
if (pp.extraGoals !== 1) problems.push(`extraGoals ${pp.extraGoals}`);
if (!(pp.passUntil > new Date())) problems.push("pass not active");
if (pp.nameColor !== "gold" || pp.avatarRing !== "fire" || pp.title !== "Финансовый оракул") problems.push(`cosmetics ${pp.nameColor}/${pp.avatarRing}/${pp.title}`);
// The shop allows 10 buys a minute per user: this is the 10th.
const dupe = await page.evaluate(async () => (await fetch("/api/shop/buy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: "name-gold" }) })).status);
if (dupe !== 409) problems.push(`double cosmetic buy status ${dupe}`);
ok(`Shop: boost, goal slot, pass, chat pack, cosmetics; coins now ${pp.coins}`);
// Equip / unequip
const eq = await page.evaluate(async () => (await fetch("/api/coins/equip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: "name-gold", off: true }) })).status);
const eqBad = await page.evaluate(async () => (await fetch("/api/coins/equip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: "ring-gold" }) })).status);
pp = await prisma.profile.findUnique({ where: { userId: user.id } });
if (eq !== 200 || pp.nameColor !== "") problems.push(`unequip ${eq} ${pp.nameColor}`);
if (eqBad !== 403) problems.push(`equip unowned status ${eqBad}`);
await page.goto(BASE + "/pro");
await card("name-gold").getByRole("button", { name: "Надеть" }).click();
await page.waitForTimeout(800);
pp = await prisma.profile.findUnique({ where: { userId: user.id } });
if (pp.nameColor !== "gold") problems.push("equip via UI failed");
await page.goto(BASE + "/profile");
if (!(await page.locator("h1.name-gold").count())) problems.push("profile name color not shown");
if (!(await page.locator(".avatar.ring-fire").count())) problems.push("profile ring not shown");
ok("Equip/unequip cosmetics, shown on profile");
// Effects
await page.goto(BASE + "/ai");
const q3 = await page.getByTestId("chat-quota").textContent();
if (!q3.includes("из 55")) problems.push(`chat pack quota ${q3}`);
await page.goto(BASE + "/learn/investicii-do-pervogo-portfelya/portfel-obligacii-i-ofz");
if (await page.getByTestId("premium-lock").count()) problems.push("pass: lesson still locked");
const cs2 = await page.evaluate(async (id) => (await fetch(`/api/lessons/${id}/complete`, { method: "POST" })).json(), l2.id);
if (cs2.xp?.gained !== 40) problems.push(`xp boost: gained ${JSON.stringify(cs2.xp)}`);
if (cs2.xp?.coins !== 10) problems.push(`coins per lesson ${cs2.xp?.coins}`);
await page.goto(BASE + "/library/oshibki-nachinayushchih-investorov");
if (await page.getByTestId("premium-lock").count()) problems.push("pass: article still locked");
ok("Effects: +30 questions, pass unlocks premium, x2 XP (coins not doubled)");
// Stars coin packs: without a bot token the buttons say "Скоро" and the API refuses
await page.goto(BASE + "/pro");
await page.getByTestId("coin-packs").waitFor();
const packStatus = await page.evaluate(async () => (await fetch("/api/coins/stars", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: "coins-1000" }) })).status);
const badPack = await page.evaluate(async () => (await fetch("/api/coins/stars", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: "coins-999999" }) })).status);
if (badPack !== 422) problems.push(`bad pack status ${badPack}`);
if (!process.env.TELEGRAM_BOT_TOKEN && packStatus !== 503) problems.push(`stars pack w/o token ${packStatus}`);
ok(`Coin packs: invalid pack ${badPack}, checkout ${packStatus}`);
// Webhook credits a pack exactly once (needs the server started with the same TELEGRAM_WEBHOOK_SECRET)
if (process.env.TELEGRAM_WEBHOOK_SECRET) {
  const pid = `tgc_e2e${Date.now()}`;
  await prisma.payment.create({ data: { id: pid, userId: user.id, plan: "coins-300", amount: 99, provider: "telegram" } });
  const before = (await prisma.profile.findUnique({ where: { userId: user.id } })).coins;
  const upd = { message: { chat: { id: 1 }, successful_payment: { currency: "XTR", total_amount: 99, invoice_payload: pid, telegram_payment_charge_id: `ch_${pid}` } } };
  for (let i = 0; i < 2; i++) await fetch(BASE + "/api/telegram/webhook", { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET }, body: JSON.stringify(upd) });
  const after = (await prisma.profile.findUnique({ where: { userId: user.id } })).coins;
  if (after - before !== 300) problems.push(`webhook credited ${after - before}`);
  ok(`Webhook: pack credited once (+${after - before})`);
}

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
