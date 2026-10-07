// Crawls every reachable page as a logged-out visitor and as an active user; reports 5xx, error screens and JS errors.
// Usage: BASE_URL=http://localhost:3000 node scripts/crawl.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAX = Number(process.env.MAX_PAGES ?? 400);
const problems = [];
const report = (m) => { problems.push(m); console.log(" ✗ " + m); };
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

const ERROR_TEXT = /Не удалось загрузить страницу|Application error|Internal Server Error|This page couldn’t load/i;

async function crawl(ctx, label, seeds, skip = () => false) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/401|404/.test(m.text()) && errs.push(`console: ${m.text().slice(0, 200)}`));
  page.on("response", (r) => r.status() >= 500 && errs.push(`HTTP ${r.status()} ${r.url()}`));
  const seen = new Set();
  const queue = [...seeds];
  let n = 0;
  while (queue.length && n < MAX) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    n++;
    if (n % 25 === 0) console.log(`  … [${label}] ${n} страниц`);
    await page.waitForTimeout(150);
    errs.length = 0;
    let status = 0;
    try {
      const res = await page.goto(BASE + url, { waitUntil: "load", timeout: 30_000 });
      status = res?.status() ?? 0;
    } catch (e) {
      report(`[${label}] ${url}: navigation failed: ${e.message.split("\n")[0]}`);
      continue;
    }
    const body = await page.locator("body").innerText().catch(() => "");
    if (status >= 500) report(`[${label}] ${url}: HTTP ${status}`);
    if (ERROR_TEXT.test(body)) report(`[${label}] ${url}: error screen`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) report(`[${label}] ${url}: horizontal overflow`);
    for (const e of errs) report(`[${label}] ${url}: ${e}`);
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of links) {
      if (!h || !h.startsWith("/") || h.startsWith("//") || h.startsWith("/api/") || h.startsWith("/ai?q=")) continue;
      const clean = h.split("#")[0];
      if (!seen.has(clean) && !skip(clean)) queue.push(clean);
    }
  }
  await page.close();
  console.log(`✓ [${label}] проверено страниц: ${n}${queue.length ? ` (ещё в очереди ${queue.length})` : ""}`);
  return [...seen];
}

// 1. Logged out
const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await crawl(anon, "гость", ["/", "/login", "/register", "/dashboard", "/library", "/does-not-exist"]);
await anon.close();

// 2. Active user: register, onboard, do things, then crawl everything
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE + "/register");
await p.getByLabel("Имя").fill("Краулер Тест");
await p.getByLabel("Email").fill(`crawl+${Date.now()}@pigsen.test`);
await p.getByLabel("Пароль").fill("supersecret1");
  await p.getByLabel(/Мне есть 18/).check();
await p.getByRole("button", { name: "Зарегистрироваться" }).click();
await p.waitForURL("**/onboarding");
await p.getByRole("button", { name: /^Startups/ }).click();
await p.getByRole("button", { name: /Продолжить/ }).click();
await p.waitForURL("**/dashboard");
// activity: a chat, a saved item, a completed lesson with quiz, an idea review
await p.goto(BASE + "/ai");
await p.getByLabel("Вопрос для $PIG").fill("Что такое юнит-экономика?");
await p.getByRole("button", { name: "Отправить" }).click();
await p.getByRole("button", { name: "Копировать ответ" }).waitFor({ timeout: 90_000 });
await p.goto(BASE + "/library");
await p.locator("button[aria-label='Сохранить']").first().click();
await p.goto(BASE + "/learn");
await p.locator("a[href^='/learn/']").first().click();
await p.locator("a.ms-link, a[href^='/learn/'][href*='/']").last().click().catch(() => {});
await p.waitForTimeout(800);
await p.close();
const userPages = await crawl(ctx, "пользователь", ["/dashboard", "/ai", "/learn", "/library", "/saved", "/search", "/search?q=стартап", "/search?q=zzzzqqq", "/tools", "/savings", "/savings/nope", "/pro", "/profile", "/learn/nope", "/library/nope", "/ai/nope"], (u) => u === "/logout");

// 3. Phone width, top-level pages
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
const top = userPages.filter((u) => u.split("/").length <= 3).slice(0, 60);
await crawl(phone, "телефон", top, () => true);
await ctx.close();
await phone.close();
await browser.close();

console.log(problems.length ? "\nПроблемы:\n" + [...new Set(problems)].map((x) => " ✗ " + x).join("\n") : "\nВсё чисто");
process.exit(problems.length ? 1 : 0);
