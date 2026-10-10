// E2E for gamification, quizzes, tools and the fact of the day.
// Usage: BASE_URL=http://localhost:3000 node scripts/e2e-boom.mjs
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
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${tag}-${n}.png`, fullPage: false });

  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill("Мария Тест");
  await page.getByLabel("Email").fill(`boom+${Date.now()}${tag}@pigsen.test`);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/new");
  await page.goto(BASE + "/dashboard");

  // Dashboard: level, streak, fact of the day, tool shortcuts
  await page.getByText("Стажёр").first().waitFor();
  await page.getByText("Факт дня").waitFor();
  await shot("dashboard");
  log(`[${tag}] Главная: уровень, серия, факт дня`);

  // Lesson: complete → +20 XP, then quiz
  await page.goto(BASE + "/learn");
  await page.locator("a[href^='/learn/']").first().click();
  await page.waitForURL(/\/learn\/[^/]+$/);
  await page.locator("a[href*='/learn/'][href$='']").filter({ hasText: /Урок|Начать|Продолжить/ }).first().click().catch(async () => {
    await page.locator(".ms-link, a[href^='/learn/'] >> nth=1").first().click();
  });
  await page.waitForURL(/\/learn\/[^/]+\/[^/]+$/);
  await page.getByRole("button", { name: /Отметить как завершённый/ }).click();
  await page.locator(".toast").getByText(/\+20 XP/).waitFor();
  log(`[${tag}] Урок завершён`, "+20 XP");

  await page.getByRole("button", { name: "Начать квиз" }).click();
  await page.locator(".quiz-opt").first().waitFor({ timeout: 60_000 });
  const n = await page.locator(".quiz-opt").count();
  if (n !== 4) problems.push(`[${tag}] quiz options = ${n}`);
  for (let i = 0; i < 6; i++) {
    const done = await page.locator(".quiz-score").isVisible();
    if (done) break;
    await page.locator(".quiz-opt").first().click();
    await shot("quiz");
    await page.locator(".quiz").getByRole("button", { name: /Дальше|Проверить/ }).click();
    await page.waitForTimeout(200);
  }
  await page.locator(".quiz-score").waitFor();
  const score = await page.locator(".quiz-score .num").innerText();
  await shot("quiz-done");
  log(`[${tag}] Квиз пройден`, score);

  // Tools: compound calc reacts to input, unit verdict, goal, idea review
  await page.goto(BASE + "/tools?tab=compound");
  const total = page.locator(".calc-kpis b").first();
  const before = await total.innerText();
  await page.getByLabel("Срок").fill("20");
  await page.waitForTimeout(100);
  const after = await total.innerText();
  if (before === after) problems.push(`[${tag}] compound calc did not update`);
  await shot("compound");
  log(`[${tag}] Сложный процент`, `${before} → ${after}`);

  await page.getByRole("tab", { name: /Юнит-экономика/ }).click();
  await page.getByLabel("Стоимость привлечения (CAC)").fill("50000");
  await page.locator(".calc-verdict.neg").waitFor();
  await shot("unit");
  log(`[${tag}] Юнит-экономика`, "вердикт меняется");

  await page.getByRole("tab", { name: /Цель накоплений/ }).click();
  await page.getByText("Срок до цели").waitFor();
  log(`[${tag}] Цель накоплений`);

  await page.getByRole("tab", { name: /Разбор идеи/ }).click();
  await page.getByLabel("Описание бизнес-идеи").fill("Сервис для кофеен: AI анализирует продажи и подсказывает цены и меню. Клиенты — владельцы небольших кофеен, проблема в том, что цены ставят наугад. Подписка 1990 руб в месяц.");
  await page.getByRole("button", { name: "Разобрать идею" }).click();
  await page.locator(".idea-card .score").first().waitFor({ timeout: 60_000 });
  await page.locator(".toast").getByText(/\+15 XP/).waitFor();
  await shot("idea");
  log(`[${tag}] Разбор идеи`, await page.locator(".idea-card .score").first().innerText());

  // Profile: XP and badges updated
  await page.goto(BASE + "/profile?tab=progress");
  await page.getByText(/Бейджи · \d+ из \d+/).waitFor();
  const badges = await page.getByText(/Бейджи · \d+ из \d+/).innerText();
  const xp = await page.locator(".metric", { hasText: "Опыт" }).locator(".v").innerText();
  if (parseInt(xp, 10) < 35) problems.push(`[${tag}] unexpected XP: ${xp}`);
  await shot("profile");
  log(`[${tag}] Профиль`, `${xp}, ${badges}`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (over) problems.push(`[${tag}] horizontal overflow on profile`);
  await page.goto(BASE + "/tools?tab=unit");
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) problems.push(`[${tag}] horizontal overflow on tools`);
  await page.goto(BASE + "/dashboard");
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) problems.push(`[${tag}] horizontal overflow on dashboard`);
  await shot("dashboard-after");
  await ctx.close();
}

try {
  await run({ width: 1440, height: 900 }, "d");
  await run({ width: 390, height: 844 }, "m");
} catch (e) {
  problems.push(`FAILED: ${e.message.split("\n")[0]}`);
}
await browser.close();
console.log(problems.length ? "\nПроблемы:\n" + problems.map((p) => " ✗ " + p).join("\n") : "\nВсё чисто");
process.exit(problems.length ? 1 : 0);
