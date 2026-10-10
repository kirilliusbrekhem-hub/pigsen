// E2E for community likes/replies, chat rooms, direct messages, visits/attribution.
// Usage: BASE_URL=... DATABASE_URL=... node scripts/e2e-social.mjs
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
async function mk(w) {
  const p = await (await browser.newContext({ viewport: { width: w, height: 800 } })).newPage();
  p.on("pageerror", (e) => problems.push(`[${w}] pageerror ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && problems.push(`[${w}] HTTP ${r.status()} ${r.url()}`));
  return p;
}
async function register(p, email, q = "") {
  await p.goto(BASE + "/" + q);
  await p.waitForTimeout(800);
  await p.goto(BASE + "/register");
  await p.getByLabel("Имя").fill("Соц Тест");
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Пароль").fill("supersecret1");
  await p.getByLabel(/Мне есть 18/).check();
  await p.getByRole("button", { name: "Зарегистрироваться" }).click();
  await p.waitForURL("**/new");
  await p.goto(BASE + "/dashboard");
  const u = await prisma.user.findUnique({ where: { email } });
  return u;
}
const call = (p, url, method, body) => p.evaluate(async ([url, method, body]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null)]; }, [url, method, body]);

const t = Date.now();
const a = await mk(1280), b = await mk(360);
const ua = await register(a, `sa+${t}@pigsen.test`, "?utm_source=telegram&utm_campaign=launch");
const ub = await register(b, `sb+${t}@pigsen.test`);
const attr = await prisma.attribution.findUnique({ where: { userId: ua.id } });
if (attr?.source !== "telegram") problems.push(`attribution ${JSON.stringify(attr)}`);
if (!(await prisma.visit.count({ where: { source: "telegram" } }))) problems.push("visit not recorded");
ok(`Attribution: ${attr?.source}/${attr?.campaign}`);

const until = new Date(Date.now() + 86_400_000);
await prisma.profile.update({ where: { userId: ua.id }, data: { proUntil: until } });
const [ps, post] = await call(a, "/api/community", "POST", { text: "Первая продажа на Авито! +3000 ₽ в копилку", kind: "win", topic: "savings" });
if (ps >= 300) problems.push(`post ${ps} ${JSON.stringify(post)}`);
const postId = post?.id ?? post?.post?.id;
const [ls] = await call(a, `/api/community/${postId}/like`, "POST");
const [rs] = await call(a, "/api/community", "POST", { text: "Сам себе коммент", parentId: postId });
const [fs] = await call(b, `/api/community/${postId}/like`, "POST");
ok(`Feed: post ${ps}, like ${ls}, reply ${rs}, free like ${fs}`);
if (ls >= 300 || rs >= 300 || fs !== 403) problems.push(`feed statuses like ${ls} reply ${rs} freeLike ${fs}`);

const [cs] = await call(a, "/api/chat/business", "POST", { text: "Привет, бизнес-чат!" });
const [cg, chat] = await call(a, "/api/chat/business", "GET");
const [cf] = await call(b, "/api/chat/business", "GET");
if (cs >= 300 || cg !== 200 || cf !== 403) problems.push(`chat ${cs} ${cg} ${cf}`);
ok(`Chat: send ${cs}, read ${cg}, free ${cf}`);

const [d1] = await call(b, `/api/dm/${ua.id}`, "POST", { text: "Привет!" });
const [d2] = await call(a, `/api/dm/${ub.id}`, "POST", { text: "Привет, это Pro!" });
const [d3] = await call(b, `/api/dm/${ua.id}`, "POST", { text: "Ответ от free" });
const [, unread] = await call(b, "/api/dm/unread", "GET");
if (d1 !== 403 || d2 >= 300 || d3 >= 300) problems.push(`dm ${d1} ${d2} ${d3}`);
ok(`DM: free start ${d1}, pro ${d2}, free reply ${d3}, unread ${JSON.stringify(unread)}`);
const [, thread] = await call(b, `/api/dm/${ua.id}`, "GET");
if (JSON.stringify(thread).includes("@pigsen.test")) problems.push("email leaked in dm");

for (const [w, p] of [[1280, a], [360, b]]) for (const path of ["/community", "/community/chat", "/messages", `/messages/${w === 1280 ? ub.id : ua.id}`, "/admin", "/admin/marketing"]) {
  await p.goto(BASE + path);
  await p.waitForTimeout(400);
  if (w === 360 && (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))) problems.push(`overflow ${path}`);
}
ok("Pages render");
await browser.close();
await prisma.$disconnect();
if (problems.length) { console.log("\nПроблемы:\n" + problems.join("\n")); process.exit(1); }
console.log("\nВсё чисто");
