// End-to-end user scenario for PIGSEN (Playwright).
// Usage: start the app (npm run build && npm start), then: BASE_URL=http://localhost:3000 npm run e2e
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "e2e-shots";
mkdirSync(SHOTS, { recursive: true });

const problems = [];
const log = (step, msg = "ok") => console.log(`✓ ${step}${msg === "ok" ? "" : ` — ${msg}`}`);

function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("401 (Unauthorized)")) problems.push(`[${label}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() === 401 && !r.url().includes("/api/auth/login")) problems.push(`[${label}] HTTP 401 ${r.url()}`);
    if (r.status() >= 500) problems.push(`[${label}] HTTP ${r.status()} ${r.url()}`);
  });
}

async function noHorizontalOverflow(page, where) {
  const over = await page.evaluate(() => {
    const els = [document.documentElement, document.querySelector(".main")].filter(Boolean);
    return els.some((el) => el.scrollWidth > el.clientWidth + 1);
  });
  if (over) problems.push(`horizontal overflow on ${where}`);
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
let current = null;

async function desktopScenario() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  watch(page, "desktop");
  current = page;
  const email = `e2e+${Date.now()}@pigsen.test`;

  // 1. Open PIGSEN
  await page.goto(BASE + "/");
  await page.getByRole("heading", { name: /Make your money/ }).waitFor();
  await shot(page, "01-landing");
  log("1. Открыть PIGSEN");

  // 2. Register (with a validation check first)
  await page.getByRole("link", { name: "Начать" }).click();
  await page.waitForURL("**/register");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.getByText("Минимум 2 символа").waitFor();
  await page.getByLabel("Имя").fill("Кирилл Тестов");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("supersecret1");
  await shot(page, "02-register");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/onboarding");
  for (const n of ["Startups", "AI", "Finance"]) await page.getByRole("button", { name: new RegExp(`^${n}`) }).click();
  await shot(page, "02b-onboarding");
  await page.getByRole("button", { name: /Продолжить/ }).click();
  log("2. Зарегистрироваться", email);

  // 3. Dashboard
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: /Кирилл/ }).waitFor();
  await page.getByText("Продолжить обучение").waitFor();
  await page.getByText("Персонально для вас").waitFor();
  await shot(page, "03-dashboard");
  log("3. Dashboard");

  // 4. Open AI
  await page.locator(".sidebar").getByRole("link", { name: /\$PIG/ }).click();
  await page.waitForURL("**/ai");
  await page.getByText(/спросите о бизнесе что угодно/).waitFor();
  log("4. Открыть AI");

  // 5-6. Ask and get an answer
  const q = "Объясни мне, как работает венчурное финансирование.";
  await page.getByLabel("Вопрос для $PIG").fill(q);
  await page.getByRole("button", { name: "Отправить" }).click();
  await page.locator(".q-msg .bubble", { hasText: q }).waitFor();
  await page.getByRole("button", { name: "Копировать ответ" }).waitFor({ timeout: 90_000 });
  const answer = await page.locator(".answer .md").last().innerText();
  if (!/венчур|фонд|инвест/i.test(answer)) problems.push("AI answer does not look relevant");
  if (!/\/ai\/c/.test(page.url())) problems.push(`AI URL not updated to conversation: ${page.url()}`);
  await shot(page, "05-ai-answer");
  log("5-6. Задать вопрос и получить ответ", `${answer.length} символов`);

  // Follow-up keeps the dialog going
  await page.locator(".chip").first().click();
  await page.locator(".q-msg").nth(1).waitFor();
  await page.locator(".ans-actions").nth(1).waitFor({ timeout: 90_000 });
  log("6b. Продолжение диалога (follow-up)");

  // Global search from the top bar
  await page.locator(".top-search input").fill("юнит-экономика");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/search?q=*");
  await page.getByRole("heading", { name: /юнит-экономика/ }).waitFor();
  const results = await page.locator(".c-card").count();
  if (!results) problems.push("search returned no content cards");
  await shot(page, "06c-search");
  log("6c. Глобальный поиск", `${results} карточек`);

  // 7. Business content
  await page.locator(".sidebar").getByRole("link", { name: "Библиотека" }).click();
  await page.waitForURL("**/library");
  await page.getByRole("link", { name: /Книги/ }).click();
  await page.waitForURL("**/library?type=book");
  await page.locator(".c-card").first().waitFor();
  await page.getByRole("link", { name: /^Все\s*\d+/ }).click();
  await page.waitForURL(/\/library$/);
  await shot(page, "07-library");
  log("7. Открыть Business Content (+ фильтр по типу)");

  // 8. Open material
  await page.getByRole("link", { name: "Как устроено венчурное финансирование" }).first().click();
  await page.waitForURL("**/library/kak-ustroeno-venchurnoe-finansirovanie");
  await page.getByText("Конспект PIGSEN").waitFor();
  log("8. Открыть материал");

  // 9. Save
  await page.getByRole("button", { name: "Сохранить", exact: true }).first().click();
  await page.getByRole("button", { name: "Сохранено" }).first().waitFor();
  await page.getByText("Сохранено в «Сохранённое»").waitFor();
  await shot(page, "09-material-saved");
  log("9. Сохранить");

  // 10. Saved
  await page.locator(".sidebar").getByRole("link", { name: /Сохранённое/ }).click();
  await page.waitForURL("**/saved");
  await page.getByRole("link", { name: "Как устроено венчурное финансирование" }).waitFor();
  await shot(page, "10-saved");
  log("10. Открыть Saved");

  // 11. Start learning
  await page.locator(".sidebar").getByRole("link", { name: "Обучение" }).click();
  await page.waitForURL("**/learn");
  await page.getByRole("link", { name: /Основы предпринимательства/ }).first().click();
  await page.waitForURL("**/learn/osnovy-predprinimatelstva");
  await page.getByRole("link", { name: /Начать обучение/ }).click();
  await page.waitForURL("**/learn/osnovy-predprinimatelstva/chto-takoe-startap");
  log("11. Начать обучение");

  // 12. Complete lesson
  await page.getByRole("button", { name: /Отметить как завершённый/ }).click();
  await page.getByRole("button", { name: /Урок пройден/ }).waitFor();
  await page.waitForTimeout(600);
  await shot(page, "12-lesson-complete");
  log("12. Завершить урок");

  // 13. Progress
  await page.goto(BASE + "/learn/osnovy-predprinimatelstva");
  await page.getByText("1 из 4 пройдено").waitFor();
  await page.goto(BASE + "/learn");
  await page.getByText("1 из 45 уроков").waitFor();
  await page.goto(BASE + "/dashboard");
  const pct = await page.locator(".hero-stats .big").innerText();
  if (pct.replace(/\D/g, "") === "0") problems.push("dashboard progress still 0%");
  await shot(page, "13-progress");
  log("13. Проверить Progress", pct.replace(/\s/g, ""));

  // 14. Profile (+ a setting that must persist)
  await page.locator(".sidebar .me").click();
  await page.waitForURL("**/profile");
  await page.getByRole("link", { name: "Настройки" }).click();
  await page.getByRole("radio", { name: "Тёмная" }).click();
  await page.getByText("Настройки сохранены").waitFor();
  await page.reload();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (theme !== "dark") problems.push(`theme did not persist (got ${theme})`);
  await shot(page, "14-profile-settings-dark");
  await page.getByRole("radio", { name: "Авто" }).click();
  await page.getByText("Настройки сохранены").first().waitFor();
  await page.getByRole("link", { name: "Прогресс" }).click();
  await page.getByText("Уроков пройдено").waitFor();
  await page.getByRole("link", { name: "Личные данные" }).click();
  await page.getByLabel("О себе").fill("Учусь строить свой первый стартап");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await page.getByText("Профиль сохранён").waitFor();
  await shot(page, "14-profile");
  log("14. Открыть Profile (тема, прогресс, личные данные)");

  // 15. Back to AI: history, continue, delete
  await page.locator(".sidebar").getByRole("link", { name: /\$PIG/ }).click();
  await page.waitForURL("**/ai");
  const convo = page.locator(".ctx .convo-item a").first();
  await convo.waitFor();
  await convo.click();
  await page.waitForURL("**/ai/*");
  await page.locator(".q-msg").first().waitFor();
  await page.getByLabel("Вопрос для $PIG").fill("А что такое юнит-экономика?");
  await page.keyboard.press("Enter");
  await page.locator(".ans-actions").nth(2).waitFor({ timeout: 90_000 });
  await shot(page, "15-ai-history");
  await page.locator(".ctx .convo-item .del").first().click();
  await page.locator(".ctx .convo-item").getByRole("button", { name: "Удалить" }).click();
  await page.getByText("Разговор удалён").waitFor();
  log("15. Вернуться в AI (история, продолжение, удаление)");

  // Auth: logout, protected route, login
  await page.goto(BASE + "/profile?tab=security");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL("**/login");
  await page.goto(BASE + "/saved");
  await page.waitForURL("**/login?next=*");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("wrong-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.getByText("Неверный email или пароль").waitFor();
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/saved");
  log("Auth: выход, защита маршрутов, вход с redirect");

  // API protection
  const anon = await browser.newContext();
  const r = await anon.request.get(BASE + "/api/saved");
  if (r.status() !== 401) problems.push(`/api/saved without session returned ${r.status()}`);
  const forged = await ctx.request.post(BASE + "/api/saved", { headers: { Origin: "https://evil.example" }, data: { contentItemId: "x" } });
  if (forged.status() !== 403) problems.push(`cross-origin POST returned ${forged.status()}`);
  await anon.close();
  log("API: 401 без сессии, 403 для чужого Origin");

  await ctx.close();
  return email;
}

async function mobileScenario(email) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, "mobile");
  current = page;
  await page.goto(BASE + "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/dashboard");
  for (const [path, name] of [
    ["/dashboard", "m-dashboard"],
    ["/ai", "m-ai"],
    ["/learn", "m-learn"],
    ["/learn/osnovy-predprinimatelstva/chto-takoe-startap", "m-lesson"],
    ["/library", "m-library"],
    ["/library/zero-to-one", "m-material"],
    ["/saved", "m-saved"],
    ["/search?q=стартап", "m-search"],
    ["/profile", "m-profile"],
  ]) {
    await page.goto(BASE + path);
    await page.locator(".tabbar").waitFor();
    await noHorizontalOverflow(page, `mobile ${path}`);
    await shot(page, name);
  }
  // Tab bar navigation and the AI history sheet
  await page.locator(".tabbar").getByRole("link", { name: "Обучение" }).click();
  await page.waitForURL("**/learn");
  await page.locator(".tabbar").getByRole("link", { name: /\$PIG/ }).click();
  await page.waitForURL("**/ai");
  await page.getByRole("button", { name: /История/ }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "m-ai-history-sheet");
  log("Mobile 390px: все разделы, таб-бар, шторка истории");

  const tablet = await browser.newContext({ viewport: { width: 834, height: 1112 } });
  const tp = await tablet.newPage();
  watch(tp, "tablet");
  await tp.goto(BASE + "/login");
  await tp.getByLabel("Email").fill(email);
  await tp.getByLabel("Пароль").fill("supersecret1");
  await tp.getByRole("button", { name: "Войти" }).click();
  await tp.waitForURL("**/dashboard");
  for (const p of ["/dashboard", "/library", "/learn/osnovy-predprinimatelstva"]) {
    await tp.goto(BASE + p);
    await noHorizontalOverflow(tp, `tablet ${p}`);
  }
  await shot(tp, "t-course");
  log("Tablet 834px");
  await tablet.close();
  await ctx.close();
}

try {
  const email = await desktopScenario();
  await mobileScenario(email);
} catch (e) {
  problems.push(`FAILED: ${e.message.split("\n").slice(0, 3).join(" | ")} @ ${current?.url()}`);
  if (current) await current.screenshot({ path: `${SHOTS}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

if (problems.length) {
  console.log("\nПроблемы:");
  for (const p of problems) console.log(" ✗ " + p);
  process.exit(1);
}
console.log("\nСценарий пройден без ошибок.");
