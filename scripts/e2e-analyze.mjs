// E2E for «Разбор трат» (/analyze). Usage: BASE_URL=http://localhost:3650 CHROMIUM_PATH=... node scripts/e2e-analyze.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3650";
const SHOTS = process.env.SHOTS ?? "/mnt/project-files/pigsen-shots";
const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const problems = [];
const log = (s) => console.log(`✓ ${s}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

async function register(page, tag) {
  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill("Анна Разборова");
  await page.getByLabel("Email").fill(`analyze+${Date.now()}${tag}@pigsen.test`);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: /^Crypto/ }).click();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.waitForURL("**/dashboard");
}

async function run(viewport, tag, colorScheme) {
  const ctx = await browser.newContext({ viewport, colorScheme });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`));
  const shot = (n) => page.screenshot({ path: `${SHOTS}/analyze-${tag}-${n}.png`, fullPage: true });
  await register(page, tag);

  await page.goto(BASE + "/analyze");
  await page.getByRole("heading", { name: "Куда уходят деньги" }).waitFor();
  await page.getByText("Файл не сохраняется").waitFor();
  await shot("empty");

  // Photo tab without a vision provider
  await page.getByRole("tab", { name: "Фото чека" }).click();
  const soon = await page.getByText("Фото скоро").isVisible();
  log(`[${tag}] Фото чека: ${soon ? "«скоро»" : "загрузка доступна"}`);
  await page.getByRole("tab", { name: "CSV-выписка" }).click();

  // Rejects a non-CSV file by content sniffing
  await page.getByLabel("Файл выписки").setInputFiles({ name: "fake.csv", mimeType: "text/csv", buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0]) });
  await page.getByRole("alert").filter({ hasText: /Excel|CSV/ }).waitFor();
  log(`[${tag}] Двоичный файл под видом CSV отклонён`);

  await page.getByLabel("Файл выписки").setInputFiles(fx("tbank.csv"));
  await page.getByTestId("an-result").waitFor({ timeout: 60_000 });
  await page.getByText("Траты по категориям", { exact: true }).waitFor();
  await page.getByText("Главные утечки", { exact: true }).waitFor();
  await page.getByText("$PIG советует").waitFor();
  const recs = await page.locator(".an-recs li").count();
  if (recs !== 3) problems.push(`[${tag}] ожидали 3 совета, получили ${recs}`);
  await page.getByText("По месяцам", { exact: true }).waitFor();
  await shot("result");
  log(`[${tag}] Выписка Т-Банка разобрана: категории, утечки, месяцы, ${recs} совета`);

  // Free plan: second analysis this week is refused
  await page.getByRole("tab", { name: "Вставить текст" }).click();
  await page.getByLabel("Текст выписки").fill("12.09.2026 Пятёрочка -450,50\n13.09.2026 Яндекс Go -380");
  await page.getByRole("button", { name: "Разобрать" }).click();
  await page.getByRole("alert").filter({ hasText: "1 разбор в неделю" }).waitFor();
  log(`[${tag}] Лимит Free: 1 разбор в неделю`);

  // History: delete
  await page.getByText("Мои разборы").waitFor();

  // One-click goal
  await page.getByRole("button", { name: "Создать цель в копилке" }).click();
  await page.waitForURL(/\/savings\/[^/]+$/);
  await page.getByRole("heading", { name: "Деньги из разбора трат" }).waitFor();
  await shot("goal");
  log(`[${tag}] Цель в копилке создана`);

  await page.goto(BASE + "/analyze");
  await page.getByRole("button", { name: "Удалить разбор" }).first().click();
  await page.getByText("Разбор удалён").waitFor();
  if (await page.getByText("Мои разборы").isVisible()) problems.push(`[${tag}] разбор не удалился`);
  log(`[${tag}] Разбор удалён`);

  // API guards
  const anon = await browser.newContext();
  const r = await anon.request.get(BASE + "/api/analyze");
  if (r.status() !== 401) problems.push(`anon GET /api/analyze → ${r.status()}`);
  await anon.close();
  await ctx.close();
}

await run({ width: 1280, height: 900 }, "desktop", "light");
await run({ width: 390, height: 844 }, "mobile", "dark");
await browser.close();
if (problems.length) {
  console.error("\nПроблемы:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nВсё ок");
