// E2E for the hidden business simulator (/sim): admin gate, a full 12-week game, limits, validation.
// Usage: BASE_URL=http://localhost:3600 DATABASE_URL=... CHROMIUM_PATH=... node scripts/e2e-sim.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3600";
const SHOTS = process.env.SHOTS ?? "/mnt/project-files/pigsen-shots";
mkdirSync(SHOTS, { recursive: true });
const db = new PrismaClient();
const problems = [];
const log = (s, m) => console.log(`✓ ${s}${m ? ` — ${m}` : ""}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

async function register(page, tag) {
  const email = `sim+${Date.now()}${tag}@pigsen.test`;
  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill("Сим Тестов");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: /^Crypto/ }).click();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.waitForURL("**/dashboard");
  return email;
}

async function run(viewport, tag) {
  const ctx = await browser.newContext({ viewport, colorScheme: "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`));
  const shot = (n) => page.screenshot({ path: `${SHOTS}/sim-${tag}-${n}.png`, fullPage: true });

  const email = await register(page, tag);

  // Hidden for non-admins: page and APIs are 404
  // The (app) segment streams (loading.tsx), so notFound() renders the 404 UI with a 200 status, like /admin.
  await page.goto(BASE + "/sim");
  await page.getByText("Страница не найдена").waitFor();
  if (await page.getByText("Бизнес-симулятор").count()) problems.push(`[${tag}] /sim leaks to non-admin`);
  for (const [m, u, d] of [["get", "/api/sim"], ["post", "/api/sim", { kind: "coffee" }], ["post", "/api/sim/abcdefghijkl/turn", { week: 1, decisions: {} }]]) {
    const r = await page.request[m](BASE + u, d ? { data: d } : undefined);
    if (r.status() !== 404) problems.push(`[${tag}] ${m} ${u} non-admin → ${r.status()}`);
  }
  log(`[${tag}] Скрыто от обычных пользователей`, "404");

  // Grant admin
  const user = await db.user.findUnique({ where: { email } });
  await db.adminGrant.create({ data: { userId: user.id } });

  await page.goto(BASE + "/sim");
  await page.getByRole("heading", { name: /Управляйте бизнесом/ }).waitFor();
  await shot("pick");

  // Validation
  const bad = await page.request.post(BASE + "/api/sim", { data: { kind: "casino" } });
  if (bad.status() !== 422) problems.push(`[${tag}] bad kind → ${bad.status()}`);

  const kind = tag === "390" ? "Кофейня" : "Барбершоп";
  await page.getByRole("button", { name: new RegExp(kind) }).click();
  await page.getByText("Неделя 1 из 12").waitFor();
  await shot("week1");

  const runId = (await (await page.request.get(BASE + "/api/sim")).json()).run.id;
  const extra = await page.request.post(`${BASE}/api/sim/${runId}/turn`, { data: { week: 1, decisions: { price: "free" } } });
  if (extra.status() !== 422) problems.push(`[${tag}] bad decision → ${extra.status()}`);
  const skip = await page.request.post(`${BASE}/api/sim/${runId}/turn`, { data: { week: 5, decisions: {} } });
  if (skip.status() !== 409) problems.push(`[${tag}] wrong week → ${skip.status()}`);

  // Play: moderate ads + a stock lot every week
  for (let w = 1; w <= 12; w++) {
    const head = page.locator(".sim-week");
    if (!(await head.textContent()).startsWith("Неделя")) break;
    await page.getByRole("button", { name: "Умеренно" }).click();
    await page.locator(".sim-decision").nth(2).locator(".sim-option").nth(1).click();
    await page.getByRole("button", { name: "Сыграть неделю" }).click();
    await page.waitForFunction((n) => {
      const t = document.querySelector(".sim-week")?.textContent ?? "";
      return !t.startsWith(`Неделя ${n} `);
    }, w, { timeout: 30_000 });
    await page.getByTestId("sim-review").waitFor();
    if (w === 3) await shot("week4");
  }
  await page.getByTestId("sim-result").waitFor();
  await page.getByText("Уроки этой игры").waitFor();
  await shot("result");
  const final = (await (await page.request.get(`${BASE}/api/sim/${runId}`)).json()).run;
  log(`[${tag}] Игра завершена`, `${final.status}, ${final.result.score} очков, +${final.result.reward} PigCoin$`);
  if (final.history.length < 1) problems.push(`[${tag}] empty history`);
  if (final.status === "finished" && final.history.length !== 12) problems.push(`[${tag}] history ${final.history.length}`);
  const tx = await db.coinTx.findFirst({ where: { userId: user.id, reason: "sim" } });
  if (!tx) problems.push(`[${tag}] no PigCoin$ reward`);

  // Free plan: 1 run per day
  const again = await page.request.post(BASE + "/api/sim", { data: { kind: "shop" } });
  if (again.status() !== 403) problems.push(`[${tag}] second free run → ${again.status()}`);
  await page.goto(BASE + "/sim");
  await page.getByText(/бесплатная игра сыграна/).waitFor();
  await shot("limit");
  log(`[${tag}] Лимит Free: 1 игра в день`);

  // Pro: unlimited
  await db.profile.update({ where: { userId: user.id }, data: { proUntil: new Date(Date.now() + 86_400_000) } });
  const pro = await page.request.post(BASE + "/api/sim", { data: { kind: "shop" } });
  if (pro.status() !== 201) problems.push(`[${tag}] pro second run → ${pro.status()}`);
  log(`[${tag}] Pro: без лимита`);
  await ctx.close();
}

try {
  await run({ width: 390, height: 844 }, "390");
  await run({ width: 1440, height: 900 }, "1440");
} catch (e) {
  problems.push(`fatal: ${e.message}`);
} finally {
  await browser.close();
  await db.$disconnect();
}
if (problems.length) {
  console.error("\nПроблемы:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nВсе проверки пройдены");
