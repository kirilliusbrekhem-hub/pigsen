// E2E for the smart piggy bank, spend check, coach, PigCoin$ shop and Pro page.
// Usage: BASE_URL=http://localhost:3000 node scripts/e2e-savings.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { deflateSync, crc32 } from "node:zlib";

const DB = process.env.DATABASE_URL ?? "postgresql://postgres:pg@localhost:5432/pigsen";
const sql = (q) => execFileSync("psql", [DB, "-qtAc", q]).toString().trim();
const PROJ = process.env.SHOTS ?? "/mnt/project-files/pigsen-shots";
mkdirSync(PROJ, { recursive: true });
const CRON = process.env.CRON_SECRET ?? "";

// Tiny valid JPEG (1×1) with an EXIF APP1 segment carrying a fake GPS tag; `salt` makes distinct images.
function jpeg(salt) {
  const base = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
  const exif = Buffer.from(`Exif\0\0GPS-SECRET-${salt}`, "latin1");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0, exif.length + 2]), exif]);
  return `data:image/jpeg;base64,${Buffer.concat([base.subarray(0, 2), app1, base.subarray(2)]).toString("base64")}`;
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "e2e-shots";
mkdirSync(SHOTS, { recursive: true });
const problems = [];
const log = (s, m) => console.log(`✓ ${s}${m ? ` — ${m}` : ""}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

async function run(viewport, tag) {
  const ctx = await browser.newContext({ viewport, colorScheme: "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`));
  const shot = (n) => page.screenshot({ path: `${SHOTS}/save-${tag}-${n}.png`, fullPage: true });

  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill("Иван Копилкин");
  await page.getByLabel("Email").fill(`save+${Date.now()}${tag}@pigsen.test`);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/new");
  await page.goto(BASE + "/dashboard");

  // Create a goal with a deadline and a starting amount
  await page.goto(BASE + "/savings");
  await page.getByText("На что копим?").waitFor();
  await page.getByLabel("Цель").fill("Отпуск на море");
  await page.getByLabel("Сколько нужно, ₽").fill("100000");
  await page.getByLabel("Уже есть, ₽").fill("20000");
  const d = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("К какому сроку (необязательно)").fill(d);
  await page.getByLabel("Зачем это мне (поможет не сорваться)").fill("Отдохнуть всей семьёй");
  await page.getByRole("button", { name: /Путешествие/ }).click();
  await page.getByRole("button", { name: "Создать цель" }).click();
  await page.waitForURL(/\/savings\/[^/]+$/);
  await page.getByRole("heading", { name: "Отпуск на море" }).waitFor();
  await page.getByText("20%").first().waitFor();
  await shot("goal");
  log(`[${tag}] Цель создана`, "20%");

  // Deposit → +5 coins and the 25% milestone (+25)
  await page.getByRole("button", { name: /\+5\s?000/ }).click();
  await page.getByText(/в копилку, \+\d+ PigCoin\$/).waitFor();
  await page.getByText("Пройдено 25% цели!").waitFor();
  log(`[${tag}] Взнос и этап 25%`, "PigCoin$ начислены");

  // Coach (Free = explanations + upsell to the Pro partner plan)
  await page.getByRole("button", { name: "Получить совет" }).click();
  await page.getByText("Упражнение:").waitFor({ timeout: 60_000 });
  await page.getByTestId("coach-lock").waitFor();
  if ((await page.getByTestId("coach-mode").getAttribute("data-mode")) !== "edu") problems.push(`[${tag}] Free coach is not in edu mode`);
  log(`[${tag}] CAP-коуч (Free: объяснения + Pro-апселл)`);

  if (tag === "desktop") await proofFlow(page, ctx);

  // Spend check → resist
  await page.getByLabel("Покупка").fill("кроссовки");
  await page.getByLabel("Сумма", { exact: true }).last().fill("8000");
  await page.getByRole("button", { name: "Проверить" }).click();
  await page.getByText("Через 10 лет при 8%").waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: /Не трачу/ }).click();
  await page.getByText("Отложено в копилку ✓").waitFor();
  await page.getByText(/Не потратил на: кроссовки/).waitFor();
  await shot("spend");
  log(`[${tag}] «Что если потрачу» и отказ от покупки`);

  // Invalid input is rejected server-side
  const bad = await page.request.post(BASE + "/api/savings", { data: { title: "x", target: -5 } });
  if (bad.status() !== 422) problems.push(`[${tag}] bad goal → ${bad.status()}`);
  const over = await page.request.post(BASE + "/api/savings/" + page.url().split("/").pop() + "/entries", { data: { amount: -10_000_000 } });
  if (over.status() !== 422) problems.push(`[${tag}] over-withdraw → ${over.status()}`);
  const prem = await page.request.post(BASE + "/api/savings", { data: { title: "Машина", target: 500000, theme: "gold" } });
  if (prem.status() !== 403) problems.push(`[${tag}] premium theme without purchase → ${prem.status()}`);
  log(`[${tag}] Серверная валидация копилки`);

  // Pro page and shop: balance shown, not enough coins for Pro
  await page.goto(BASE + "/pro");
  await page.getByText("Ваш баланс").waitFor();
  await page.getByText("Магазин").first().waitFor();
  const buy = await page.request.post(BASE + "/api/shop/buy", { data: { itemId: "pro-trial" } });
  if (buy.status() !== 402) problems.push(`[${tag}] pro-trial without coins → ${buy.status()}`);
  const pay = await page.request.post(BASE + "/api/billing/checkout", { data: { plan: "month" } });
  if (pay.status() !== 503) problems.push(`[${tag}] checkout without keys → ${pay.status()}`);
  await shot("pro");
  log(`[${tag}] Pro и магазин`);

  // Free plan: up to 3 goals
  for (const t of ["Цель 2", "Цель 3"]) await page.request.post(BASE + "/api/savings", { data: { title: t, target: 1000 } });
  const fourth = await page.request.post(BASE + "/api/savings", { data: { title: "Цель 4", target: 1000 } });
  if (fourth.status() !== 402) problems.push(`[${tag}] 4th goal on free → ${fourth.status()}`);
  await page.goto(BASE + "/savings");
  await page.getByText("Всего в копилке").waitFor();
  await shot("list");
  log(`[${tag}] Лимит целей на Free`);

  // Admin panel is invisible to regular users
  await page.goto(BASE + "/admin");
  await page.getByText("Страница не найдена").waitFor();
  if (await page.getByText("Пользователей").count()) problems.push(`[${tag}] /admin shows stats to non-admin`);
  const admApi = await page.request.post(BASE + "/api/admin/content", { data: {} });
  if (admApi.status() !== 404) problems.push(`[${tag}] /api/admin for non-admin → ${admApi.status()}`);
  log(`[${tag}] Админка закрыта для обычных пользователей`);

  // Crypto course is in the catalogue
  await page.goto(BASE + "/learn");
  await page.getByText("Криптовалюты: основы и риски").first().waitFor();
  log(`[${tag}] Крипто-курс`);
  await ctx.close();
}

async function register(ctx, tag) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`));
  const email = `save+${Date.now()}${tag}@pigsen.test`;
  sql(`DELETE FROM "RateHit" WHERE key LIKE 'register:%'`); // many test sign-ups from one IP
  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill(tag === "admin" ? "Админ Проверкин" : "Пётр Тестов");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/new");
  await page.goto(BASE + "/dashboard");
  return { page, id: sql(`SELECT id FROM "User" WHERE email = '${email}'`) };
}

/** Random-colour 48×48 PNG (optionally with a metadata text chunk that must be stripped): unique pixels, so the browser's re-encode gives a fresh hash every run. */
function png(text) {
  const w = 48;
  const rows = [];
  const [r, g, b] = [0, 0, 0].map(() => Math.floor(Math.random() * 256));
  for (let y = 0; y < w; y++) rows.push(Buffer.from([0, ...Array.from({ length: w }, (_, x) => [r, (g + x) % 256, (b + y) % 256]).flat()]));
  const chunk = (type, data) => {
    const t = Buffer.from(type, "latin1");
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(w, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...(text ? [chunk("tEXt", Buffer.from(`Comment\0${text}`, "latin1"))] : []), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

/** Proof of real savings: deposit with screenshot → на проверке → admin approves → counts in /biz/top; reuse rejected. */
async function proofFlow(page, ctx) {
  const goalId = page.url().split("/").pop();
  const me = sql(`SELECT "userId" FROM "SavingsGoal" WHERE id = '${goalId}'`);
  const biz = await page.request.post(BASE + "/api/biz", { data: { kind: "coffee", name: "Кофейня Пруф" } });
  if (!biz.ok()) problems.push(`create biz → ${biz.status()}`);
  const topGrowth = async () => {
    await page.goto(BASE + "/biz/top");
    const row = page.getByTestId("biz-top").locator("li.is-me");
    return (await row.textContent()).replace(/[\s\u00a0\u202f]/g, "");
  };
  if (!(await topGrowth()).includes("+0₽")) problems.push("unconfirmed deposits count on /biz/top before any proof");

  // UI: deposit 3 000 ₽ with a screenshot → «на проверке»
  await page.goto(BASE + "/savings/" + goalId);
  await page.waitForLoadState("networkidle"); // the picker's handler must be hydrated
  for (let i = 0; i < 3 && !(await page.getByText("Скриншот приложен").count()); i++) {
    await page.getByLabel("Скриншот перевода").setInputFiles({ name: "bank.png", mimeType: "image/png", buffer: png() });
    await page.getByText("Скриншот приложен").waitFor({ timeout: 5000 }).catch(() => null);
  }
  await page.getByText("Скриншот приложен").waitFor();
  await page.getByLabel("Сумма", { exact: true }).first().fill("3000");
  await page.getByRole("button", { name: "Отложить" }).click();
  await page.getByText(/на проверке/).first().waitFor();
  await page.reload();
  const firstBadge = page.getByTestId("proof-badge").first();
  if ((await firstBadge.getAttribute("data-state")) !== "pending") problems.push("deposit with proof is not «на проверке»");
  await page.getByTestId("proof-meter").getByText(/Подтверждено 0/).waitFor();
  await page.screenshot({ path: `${PROJ}/proof-pending.png`, fullPage: true });
  log("Взнос со скрином → «на проверке», метр «Подтверждено 0 ₽ из …»");

  // API: a distinct screenshot is accepted; the same image again is rejected and moves no money
  const img = `data:image/png;base64,${png("GPS-SECRET 55.75,37.61").toString("base64")}`;
  const ok = await page.request.post(`${BASE}/api/savings/${goalId}/entries`, { data: { amount: 1000, proof: img } });
  const okBody = await ok.json();
  if (!ok.ok() || okBody.proof?.status !== "pending") problems.push(`deposit with proof → ${ok.status()} ${JSON.stringify(okBody.proof)}`);
  const savedBefore = sql(`SELECT saved FROM "SavingsGoal" WHERE id = '${goalId}'`);
  const reuse = await page.request.post(`${BASE}/api/savings/${goalId}/entries`, { data: { amount: 1000, proof: img } });
  if (reuse.status() !== 409) problems.push(`reused screenshot → ${reuse.status()}`);
  if (sql(`SELECT saved FROM "SavingsGoal" WHERE id = '${goalId}'`) !== savedBefore) problems.push("reused screenshot still moved money");
  const fake = await page.request.post(`${BASE}/api/savings/${goalId}/entries`, { data: { amount: 1000, proof: "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64") } });
  if (fake.status() !== 422) problems.push(`non-image proof → ${fake.status()}`);
  const exifLeft = sql(`SELECT count(*) FROM "DepositProof" WHERE "userId" = '${me}' AND position('GPS-SECRET'::bytea in image) > 0`);
  if (exifLeft !== "0") problems.push(`EXIF not stripped in ${exifLeft} stored images`);
  log("Повторный скрин → 409, не-картинка → 422, EXIF вырезан");

  // Privacy + IDOR: only reviewers see the image; nobody else can attach to my deposit
  const proofId = sql(`SELECT p.id FROM "DepositProof" p JOIN "SavingsEntry" e ON e.id = p."entryId" WHERE p."userId" = '${me}' AND e.amount = 3000`);
  const own = await page.request.get(`${BASE}/api/savings/proofs/${proofId}/image`);
  if (own.status() !== 404) problems.push(`non-admin reads screenshot → ${own.status()}`);
  const stranger = await register(await browser.newContext(), "stranger");
  const myEntry = sql(`SELECT e.id FROM "SavingsEntry" e LEFT JOIN "DepositProof" p ON p."entryId" = e.id WHERE e."goalId" = '${goalId}' AND e.amount > 0 AND p.id IS NULL LIMIT 1`);
  const idor = await stranger.page.request.post(BASE + "/api/savings/proofs", { data: { entryId: myEntry, image: jpeg("idor") } });
  if (idor.status() !== 404) problems.push(`IDOR attach to another user's deposit → ${idor.status()}`);
  log("Скрин видит только проверка, IDOR закрыт");

  // Admin approves → ✓ подтверждён, meter and leaderboard count it
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await register(adminCtx, "admin");
  sql(`INSERT INTO "AdminGrant" ("userId") VALUES ('${admin.id}') ON CONFLICT DO NOTHING`);
  await admin.page.goto(BASE + "/admin/proofs");
  const card = admin.page.locator(`[data-proof="${proofId}"]`);
  await card.waitFor();
  await card.locator("img").evaluate((el) => el.complete || new Promise((r) => (el.onload = r)));
  await admin.page.screenshot({ path: `${PROJ}/proof-admin.png`, fullPage: true });
  const imgRes = await admin.page.request.get(`${BASE}/api/savings/proofs/${proofId}/image`);
  if (!imgRes.ok()) problems.push(`admin screenshot → ${imgRes.status()}`);
  await card.getByRole("button", { name: "Подтвердить" }).click();
  await card.waitFor({ state: "detached" });
  log("Админ видит скрин в /admin/proofs и подтверждает");

  await page.goto(BASE + "/savings/" + goalId);
  await page.getByTestId("proof-meter").getByText(/Подтверждено 3\s000\s₽ из/).waitFor();
  await page.locator('[data-testid="proof-badge"][data-state="confirmed"]').first().waitFor();
  await page.screenshot({ path: `${PROJ}/proof-confirmed.png`, fullPage: true });
  const growth = await topGrowth();
  if (!growth.includes("+3000₽")) problems.push(`leaderboard growth after approval: ${growth}`);
  await page.screenshot({ path: `${PROJ}/proof-top.png`, fullPage: true });
  await page.goto(BASE + "/biz");
  await page.getByTestId("member-confirmed").first().waitFor();
  log("Подтверждённый взнос: ✓ в истории, метр, лидерборд +3 000 ₽, ✓ в команде");

  // Retention: screenshots older than 30 days are wiped, status stays
  sql(`UPDATE "DepositProof" SET "createdAt" = now() - interval '31 days' WHERE id = '${proofId}'`);
  if (CRON) {
    const r = await page.request.get(BASE + "/api/cron/proofs", { headers: { authorization: `Bearer ${CRON}` } });
    if (!r.ok()) problems.push(`cron/proofs → ${r.status()}`);
    const row = sql(`SELECT status, image IS NULL, "purgedAt" IS NOT NULL FROM "DepositProof" WHERE id = '${proofId}'`);
    if (row !== "confirmed|t|t") problems.push(`after purge: ${row}`);
    log("Крон удаляет скрины старше 30 дней, статус остаётся");
  }
  const noAuth = await page.request.get(BASE + "/api/cron/proofs");
  if (noAuth.status() !== 401) problems.push(`cron without secret → ${noAuth.status()}`);
  await adminCtx.close();
  await page.goto(BASE + "/savings/" + goalId);
}

/** CAP by plan: Free = educational assistant (no partner features), Pro = business partner. Gating only (mock AI). */
async function pigModes() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  const u = await register(ctx, "pig");
  const page = u.page;
  const askPig = async (q) => {
    await page.goto(BASE + "/ai");
    await page.getByLabel("Вопрос для CAP").fill(q);
    await page.getByRole("button", { name: "Отправить" }).click();
    await page.getByRole("button", { name: "Копировать ответ" }).last().waitFor({ timeout: 90_000 });
    return page.locator(".answer .md").last().innerText();
  };
  // Free
  await page.goto(BASE + "/ai");
  if ((await page.getByTestId("pig-mode").getAttribute("data-mode")) !== "edu") problems.push("Free /ai is not in edu mode");
  const freeA = await askPig("Что купить в моей кофейне, чтобы поднять рейтинг?");
  if (!/доступен в Pro/.test(freeA) || /Партнёр на связи/.test(freeA)) problems.push("Free CAP gave game strategy / partner persona");
  await page.screenshot({ path: `${PROJ}/pig-free.png`, fullPage: false });
  const biz = await page.request.post(BASE + "/api/biz", { data: { kind: "coffee", name: "Кофейня Фри" } });
  if (!biz.ok()) problems.push(`create biz → ${biz.status()}`);
  const adv = await page.request.post(BASE + "/api/biz/advice");
  if (adv.status() !== 402) problems.push(`Free advice → ${adv.status()}`);
  await page.request.post(BASE + "/api/biz/chat", { data: { text: "CAP, что купить?" } });
  const fv = (await (await page.request.get(BASE + "/api/biz")).json()).view;
  if (fv.pigPartner || fv.chat.some((c) => c.pig)) problems.push("CAP talks in a Free team chat");
  await page.goto(BASE + "/biz");
  await page.getByTestId("pig-lock").first().waitFor();
  await page.screenshot({ path: `${PROJ}/pig-free-biz.png`, fullPage: false });
  log("Free: CAP — ассистент, без стратегии игры, без чата команды, апселл в Pro");

  // Pro (any tier)
  sql(`UPDATE "Profile" SET "proUntil" = now() + interval '30 days', "proTier" = 'pro7' WHERE "userId" = '${u.id}'`);
  await page.goto(BASE + "/ai");
  if ((await page.getByTestId("pig-mode").getAttribute("data-mode")) !== "partner") problems.push("Pro /ai is not in partner mode");
  const proA = await askPig("Что купить в моей кофейне, чтобы поднять рейтинг?");
  if (!/Партнёр на связи/.test(proA) || !/Давай попробуем/.test(proA) || !/заглядывай/.test(proA)) problems.push("Pro CAP is not a partner");
  await page.screenshot({ path: `${PROJ}/pig-pro.png`, fullPage: false });
  const adv2 = await page.request.post(BASE + "/api/biz/advice");
  if (!adv2.ok()) problems.push(`Pro advice → ${adv2.status()}`);
  await page.request.post(BASE + "/api/biz/chat", { data: { text: "CAP, привет?" } });
  const pv = (await (await page.request.get(BASE + "/api/biz")).json()).view;
  if (!pv.pigPartner || pv.chat.at(-1)?.pig !== true) problems.push("CAP doesn't answer in a Pro team chat");
  const g = await page.request.post(BASE + "/api/savings", { data: { title: "Подушка", target: 100000 } });
  const coach = await (await page.request.post(`${BASE}/api/savings/${(await g.json()).goal.id}/coach`)).json();
  if (coach.mode !== "partner") problems.push(`Pro coach mode ${coach.mode}`);
  log("Pro: CAP — партнёр (идеи, стратегия, чат команды, крючок на завтра)");
  await ctx.close();
}

try {
  await run({ width: 1280, height: 860 }, "desktop");
  await pigModes();
  await run({ width: 390, height: 844 }, "mobile");
} catch (e) {
  problems.push(`FAILED: ${e.message.split("\n").slice(0, 3).join(" | ")}`);
}
await browser.close();
if (problems.length) {
  console.log("\nПроблемы:");
  for (const p of problems) console.log(" ✗ " + p);
  process.exit(1);
}
console.log("\nКопилка, коуч, PigCoin$ и Pro работают.");
