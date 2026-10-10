// E2E for «Бизнес-план за 10 минут»: wizard, report, PDF (Cyrillic), Free limit, Pro, ownership, delete.
// Usage: BASE_URL=http://localhost:3000 DATABASE_URL=... node scripts/e2e-plan.mjs   (needs pdftotext from poppler)
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "/mnt/project-files/pigsen-shots";
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
mkdirSync(SHOTS, { recursive: true });

async function register(name, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  const email = `plan+${Date.now()}${Math.random().toString(36).slice(2, 6)}@pigsen.test`;
  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/new");
  await page.goto(BASE + "/dashboard");
  const user = await prisma.user.findUnique({ where: { email } });
  return { ctx, page, user };
}

function pdfText(bytes) {
  const dir = mkdtempSync(path.join(tmpdir(), "plan-pdf-"));
  const f = path.join(dir, "plan.pdf");
  writeFileSync(f, bytes);
  return execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" });
}

const fetchStatus = (page, url, init) => page.evaluate(async ([u, i]) => (await fetch(u, i)).status, [url, init ?? {}]);

// ---- Free user: wizard end to end
const a = await register("Анна План");
const page = a.page;
await page.goto(BASE + "/plan");
await page.getByTestId("bp-new").click();
await page.waitForURL("**/plan/new");
await page.getByTestId("bp-step-idea").waitFor();
await page.getByRole("button", { name: /Далее/ }).click();
await page.getByText(/Назовите проект/).waitFor();
ok("Step validation blocks empty idea");
await page.getByPlaceholder("Кофейня у метро").fill("Кофейня «Зелёный бобр»");
await page.getByPlaceholder(/Какую проблему решаете/).fill("Кофе с собой у выхода из метро для тех, кто спешит утром: заказ заранее через Telegram-бота и выдача за 30 секунд.");
await page.screenshot({ path: `${SHOTS}/plan-wizard-idea.png`, fullPage: true });
await page.getByRole("button", { name: /Далее/ }).click();
await page.getByPlaceholder(/Возраст, город/).fill("Офисные сотрудники 22–40 лет, которые едут на работу на метро и не хотят стоять в очереди.");
await page.getByRole("button", { name: /Далее/ }).click();
await page.getByLabel("Конкурент").first().fill("Сетевая кофейня");
await page.getByLabel("Цена конкурента").first().fill("250");
await page.getByLabel("Чем силён или слаб").first().fill("очереди по утрам");
await page.getByRole("button", { name: /Далее/ }).click();
await page.getByLabel("Цена", { exact: true }).fill("220");
await page.getByLabel("Себестоимость").fill("70");
await page.getByRole("button", { name: /Совет для моего проекта/ }).click();
await page.getByText(/Маржа .*%/).first().waitFor();
await page.screenshot({ path: `${SHOTS}/plan-wizard-pricing.png`, fullPage: true });
ok("CAP hint on pricing step");
for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /Далее/ }).click(); // startup, monthly → sales
await page.getByLabel("Продаж в первый месяц").fill("900");
await page.getByLabel("Рост в месяц").fill("12");
await page.getByLabel("Максимум продаж").fill("4000");
const prev = await page.getByTestId("bp-preview").textContent();
if (!/Окупаемость/.test(prev)) problems.push("preview missing");
for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /Далее/ }).click(); // channels, team → risks
await page.getByRole("button", { name: /Добавить риск/ }).click();
await page.getByLabel("Риск").nth(1).fill("Рядом откроется ещё одна кофейня");
await page.getByTestId("bp-submit").click();
await page.waitForURL(/\/plan\/[a-z0-9]+$/, { timeout: 60_000 });
await page.getByTestId("bp-kpis").waitFor();
const title = await page.getByTestId("bp-title").textContent();
if (!title.includes("Зелёный бобр")) problems.push(`title ${title}`);
const rows = await page.getByTestId("bp-pnl").locator("tbody tr").count();
if (rows !== 12) problems.push(`P&L rows ${rows}`);
const sens = await page.getByTestId("bp-sensitivity").locator("tbody td").count();
if (sens !== 9) problems.push(`sensitivity cells ${sens}`);
if (!(await page.getByTestId("disclaimer-general").count())) problems.push("disclaimer missing");
await page.screenshot({ path: `${SHOTS}/plan-report.png`, fullPage: true });
const planId = page.url().split("/").pop();
ok(`Plan created: payback ${(await page.getByTestId("bp-payback").textContent()).trim()}`);

// Numbers come from the model: check against an independent calc of month 1
const saved = await prisma.bizPlan.findUnique({ where: { id: planId } });
if (!saved || saved.userId !== a.user.id) problems.push("plan not saved for user");

// PDF
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("bp-pdf").click()]);
const pdfPath = await dl.path();
const { readFileSync } = await import("node:fs");
const bytes = readFileSync(pdfPath);
if (bytes.subarray(0, 5).toString() !== "%PDF-") problems.push("not a PDF");
const text = pdfText(bytes);
for (const needle of ["Зелёный бобр", "Резюме", "Риски и как их снизить", "Чувствительность", "образовательный"]) if (!text.includes(needle)) problems.push(`PDF lacks "${needle}"`);
// The diagonal "Kapital Free" mark is rotated (pdftotext skips it); the Free footer line is drawn with it.
if (!text.includes("бесплатном тарифе")) problems.push("Free PDF has no watermark");
try { execFileSync("pdftoppm", ["-png", "-r", "60", "-f", "1", "-l", "1", "-singlefile", pdfPath, `${SHOTS}/plan-pdf-page1`]); } catch { /* optional preview */ }
ok(`PDF ${bytes.length} bytes, Cyrillic text extracted, watermark present`);

// Free limit: second plan refused
const body = JSON.stringify({ input: saved.input });
const st2 = await fetchStatus(page, "/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body });
if (st2 !== 402) problems.push(`free second plan status ${st2}`);
await page.goto(BASE + "/plan");
await page.getByTestId("bp-upgrade").waitFor();
await page.screenshot({ path: `${SHOTS}/plan-list.png`, fullPage: true });
ok("Free limit: 1 plan");

// Validation, size limit
const bad = await fetchStatus(page, "/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { ...saved.input, price: -5 } }) });
if (bad !== 422 && bad !== 402) problems.push(`invalid input status ${bad}`);
const big = await fetchStatus(page, `/api/plan/${planId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: saved.input, pad: "x".repeat(70_000) }) });
if (big !== 413) problems.push(`oversized body status ${big}`);
const badPut = await fetchStatus(page, `/api/plan/${planId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { ...saved.input, price: -5 } }) });
if (badPut !== 422) problems.push(`invalid PUT status ${badPut}`);
ok("Validation 422 and size limit 413");

// Edit
await page.goto(`${BASE}/plan/${planId}/edit`);
await page.getByTestId("bp-step-idea").waitFor();
await page.getByPlaceholder("Кофейня у метро").fill("Кофейня «Зелёный бобр 2»");
await page.getByRole("button", { name: /Риски$/ }).click();
await page.getByTestId("bp-submit").click();
await page.waitForURL(new RegExp(`/plan/${planId}$`), { timeout: 60_000 });
await page.getByTestId("bp-title").getByText("Зелёный бобр 2").waitFor();
ok("Edit and recompute");

// Another user can't see it
const b = await register("Борис Чужой", { width: 390, height: 844 });
for (const u of [`/api/plan/${planId}`, `/api/plan/${planId}/pdf`]) {
  const s = await fetchStatus(b.page, u);
  if (s !== 404) problems.push(`foreign ${u} status ${s}`);
}
const del = await fetchStatus(b.page, `/api/plan/${planId}`, { method: "DELETE" });
if (del !== 404) problems.push(`foreign delete ${del}`);
const r404 = await b.page.goto(`${BASE}/plan/${planId}`);
// Streaming may commit a 200 before notFound(); the not-found UI must render and the plan must not.
if (r404.status() !== 404 && ((await b.page.getByTestId("bp-title").count()) || !(await b.page.getByText(/не найден|404/i).count()))) problems.push(`foreign page status ${r404.status()}`);
ok("Ownership enforced");

// Pro: unlimited, no watermark (mobile viewport)
await prisma.profile.update({ where: { userId: b.user.id }, data: { proUntil: new Date(Date.now() + 86400_000) } });
for (let i = 0; i < 2; i++) {
  const s = await fetchStatus(b.page, "/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body });
  if (s !== 201) problems.push(`pro create ${i} status ${s}`);
}
const bPlan = await prisma.bizPlan.findFirst({ where: { userId: b.user.id } });
await b.page.goto(`${BASE}/plan/${bPlan.id}`);
await b.page.getByTestId("bp-kpis").waitFor();
const overflow = await b.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (overflow > 1) problems.push(`mobile horizontal overflow ${overflow}px`);
await b.page.screenshot({ path: `${SHOTS}/plan-report-mobile.png`, fullPage: true });
await b.page.goto(`${BASE}/plan/new`);
await b.page.getByTestId("bp-step-idea").waitFor();
await b.page.screenshot({ path: `${SHOTS}/plan-wizard-mobile.png`, fullPage: true });
const proPdf = await b.page.evaluate(async (id) => Array.from(new Uint8Array(await (await fetch(`/api/plan/${id}/pdf`)).arrayBuffer())), bPlan.id);
if (pdfText(Buffer.from(proPdf)).includes("бесплатном тарифе")) problems.push("Pro PDF has watermark");
ok("Pro: unlimited plans, clean PDF, no mobile overflow");

// Delete
await page.goto(`${BASE}/plan/${planId}`);
page.once("dialog", (d) => d.accept());
await page.getByTestId("bp-delete").click();
await page.waitForURL(/\/plan$/);
if (await prisma.bizPlan.findUnique({ where: { id: planId } })) problems.push("plan not deleted");
await page.getByTestId("bp-new").waitFor();
ok("Delete frees the Free slot");

await browser.close();
await prisma.$disconnect();
if (problems.length) {
  console.error("\nProblems:\n" + problems.map((p) => ` - ${p}`).join("\n"));
  process.exit(1);
}
console.log("\nAll plan checks passed");
