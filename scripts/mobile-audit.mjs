// Mobile layout audit: visits every section at phone widths, flags horizontal overflow and elements wider than the screen.
// Usage: BASE_URL=http://localhost:3000 ADMIN_EMAIL=... node scripts/mobile-audit.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "e2e-shots/mobile";
mkdirSync(SHOTS, { recursive: true });
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const problems = [];

const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
const email = process.env.ADMIN_EMAIL ?? `mob+${Date.now()}@pigsen.test`;
await page.goto(BASE + "/register");
await page.getByLabel("Имя").fill("Мобильный Тестер Длинноимённый");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
await page.getByRole("button", { name: "Зарегистрироваться" }).click();
await page.waitForURL("**/onboarding");
await page.screenshot({ path: `${SHOTS}/onboarding.png`, fullPage: true });
await page.getByRole("button", { name: /^Finance/ }).click();
await page.getByRole("button", { name: /Продолжить/ }).click();
await page.waitForURL("**/dashboard");
const goal = await page.request.post(BASE + "/api/savings", { data: { title: "Очень длинное название цели на новый ноутбук для учёбы", target: 120000, initial: 30000, deadline: "2027-06-01" } });
const goalId = (await goal.json()).goal?.id;
const content = await page.request.post(BASE + "/api/admin/content", {
  data: { title: "Тестовый материал админки", description: "Описание для проверки редактора материалов", body: "## Текст", type: "article", category: "finance", author: "Админ", readingTime: 3, tags: ["тест"] },
});
const contentId = (await content.json()).id;
const firstUser = await page.request.get(BASE + "/admin/users");

const pages = [
  "/dashboard", "/ai", "/learn", "/library", "/saved", "/search?q=стартап", "/tools", "/tools?tab=compound", "/tools?tab=unit", "/tools?tab=goal",
  "/savings", `/savings/${goalId}`, "/pro", "/profile", "/profile?tab=security",
  "/admin", "/admin/users", "/admin/payments", "/admin/content", "/admin/content/new", contentId ? `/admin/content/${contentId}` : null,
].filter(Boolean);
// One course, one lesson, one library item
await page.goto(BASE + "/learn");
const course = await page.locator("a[href^='/learn/']").first().getAttribute("href");
await page.goto(BASE + course);
const lesson = await page.locator(`a[href^='${course}/']`).first().getAttribute("href").catch(() => null);
await page.goto(BASE + "/library");
const item = await page.locator("a[href^='/library/']").first().getAttribute("href");
pages.push(course, lesson, item, "/admin/users/" + (firstUser.ok() ? "" : ""));

for (const width of [360, 390]) {
  await page.setViewportSize({ width, height: 780 });
  for (const p of pages.filter((x) => x && !x.endsWith("/admin/users/"))) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const res = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - vw;
      const wide = [];
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") continue;
        let scroller = false;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (/(auto|scroll|hidden)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) { scroller = true; break; }
        }
        if (!scroller && (r.right > vw + 1 || r.left < -1)) wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
      return { over, wide: [...new Set(wide)].slice(0, 6) };
    });
    if (res.over > 1 || res.wide.length) problems.push(`[${width}] ${p}: горизонтальный сдвиг ${res.over}px ${res.wide.join(", ")}`);
    if (width === 390) {
      // The app scrolls inside <main>, so grow the viewport to the content height for a full screenshot.
      const h = await page.evaluate(() => Math.min(6000, (document.querySelector("main")?.scrollHeight ?? 780) + 140));
      await page.setViewportSize({ width, height: h });
      await page.screenshot({ path: `${SHOTS}/${p.replace(/[/?=&]/g, "_").slice(1) || "root"}.png` });
      await page.setViewportSize({ width, height: 780 });
    }
  }
}
// "Ещё" menu
await page.goto(BASE + "/dashboard");
await page.getByRole("button", { name: "Ещё" }).click();
await page.getByRole("dialog", { name: "Все разделы" }).waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOTS}/more-menu.png` });
await page.getByRole("dialog").getByRole("link", { name: "Инструменты" }).click();
await page.waitForURL("**/tools");
if (await page.getByRole("dialog", { name: "Все разделы" }).isVisible()) problems.push("Меню «Ещё» не закрылось после перехода");

await browser.close();
console.log(problems.length ? "Проблемы:\n" + problems.map((p) => " ✗ " + p).join("\n") : "Вёрстка на телефоне без вылезаний.");
process.exit(problems.length ? 1 : 0);
