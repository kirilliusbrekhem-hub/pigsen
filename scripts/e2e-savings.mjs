// E2E for the smart piggy bank, spend check, coach, PigCoin$ shop and Pro page.
// Usage: BASE_URL=http://localhost:3000 node scripts/e2e-savings.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

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
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: /^Crypto/ }).click();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.waitForURL("**/dashboard");

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

  // Coach
  await page.getByRole("button", { name: "Получить совет" }).click();
  await page.getByText("Челлендж недели:").waitFor({ timeout: 60_000 });
  log(`[${tag}] $PIG-коуч`);

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

try {
  await run({ width: 1280, height: 860 }, "desktop");
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
