// E2E for «Мой бизнес»: solo flow, team flow (2 contexts), concurrency on spending capital, IDOR, challenges, leaderboard.
// Usage: BASE_URL=http://localhost:3000 [CHROMIUM_PATH=...] node scripts/e2e-biz.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const DB = process.env.DATABASE_URL ?? "postgresql://postgres:pg@localhost:5432/pigsen";
const sql = (q) => execFileSync("psql", [DB, "-qtAc", q]).toString().trim();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "/mnt/project-files/pigsen-shots";
mkdirSync(SHOTS, { recursive: true });
const problems = [];
const log = (s, m) => console.log(`✓ ${s}${m ? ` — ${m}` : ""}`);
const check = (cond, msg) => cond || problems.push(msg);
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const stamp = Date.now();

async function user(name, tag, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, colorScheme: "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`));
  await page.goto(BASE + "/register");
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Email").fill(`biz+${stamp}${tag}@pigsen.test`);
  await page.getByLabel("Пароль").fill("supersecret1");
  await page.getByLabel(/Мне есть 18/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: /^Crypto/ }).click();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.waitForURL("**/dashboard");
  const g = await page.request.post(BASE + "/api/savings", { data: { title: "Подушка", target: 500000 } });
  const goalId = (await g.json()).goal.id;
  const entry = async (amount) => {
    const r = await page.request.post(`${BASE}/api/savings/${goalId}/entries`, { data: { amount } });
    if (!r.ok()) throw new Error(`[${tag}] entry ${amount} → ${r.status()} ${await r.text()}`);
  };
  const view = async () => (await (await page.request.get(BASE + "/api/biz")).json()).view;
  return { ctx, page, entry, view, name };
}

// ── Solo ──
const A = await user("Аня Кофеева", "a");
await A.page.goto(BASE + "/dashboard");
await A.page.getByTestId("biz-dash").waitFor();
await A.page.getByTestId("biz-dash").click();
await A.page.waitForURL("**/biz");
await A.page.getByRole("button", { name: "Открыть бизнес" }).click();
await A.page.getByTestId("biz-capital").waitFor();
check((await A.view()).business.capital === 0, "fresh capital != 0");
log("Бизнес открыт с дашборда");

await A.entry(20000);
await A.page.reload();
await A.page.locator('[data-testid="biz-capital"] b[data-value="20000"]').waitFor();
log("Взнос 20 000 ₽ → капитал 20 000 ₽");

await A.page.getByTestId("up-chairs").getByRole("button", { name: "Купить" }).click();
await A.page.locator('.bz-scene [data-item="chairs"]').waitFor();
await A.page.locator('[data-testid="biz-capital"] b[data-value="18500"]').waitFor();
await A.page.getByTestId("up-sign").getByRole("button", { name: "Купить" }).click();
await A.page.locator('.bz-scene [data-item="sign"]').waitFor();
log("Куплены стулья и вывеска → видны на сцене, капитал 16 500");
await A.page.screenshot({ path: `${SHOTS}/biz-1440-solo.png`, fullPage: true });

const before = await A.view();
await A.entry(-17000); // 500 more than free capital → newest upgrade goes "на ремонт"
const after = await A.view();
check(after.business.capital === 0, `capital after withdrawal = ${after.business.capital}`);
check(after.business.rating < before.business.rating, "rating did not fall on withdrawal");
check(after.owned.some((o) => o.status === "broken"), "no upgrade broken after over-withdrawal");
check(after.events.some((e) => e.kind === "withdraw" && /сняла?\(а\)? 17\s000/.test(e.text.replace(/ | /g, " "))), "withdraw event missing");
await A.page.reload();
await A.page.locator(".bz-item.is-broken").first().waitFor();
await A.page.getByTestId("biz-feed").getByText(/из копилки — выручка упала/).first().waitFor();
log("Снятие 17 000 ₽ → капитал 0, рейтинг ↓, улучшение на ремонте, запись в ленте");

// ── Team ──
const B = await user("Боря Партнёров", "b");
const invite = await A.page.getByTestId("biz-invite-path").textContent();
await B.page.goto(BASE + invite.trim());
await B.page.getByRole("button", { name: "Стать сооснователем" }).click();
await B.page.waitForURL("**/biz");
await B.page.getByTestId("biz-capital").waitFor();
check((await A.view()).members.length === 2, "B is not a member");
await B.entry(5000);
check((await A.view()).business.capital === 5000, "B's deposit didn't raise team capital");
await B.entry(-3000);
const teamV = await A.view();
check(teamV.business.capital === 2000, `team capital ${teamV.business.capital} != 2000`);
await A.page.reload();
await A.page.getByTestId("biz-feed").getByText(/Боря Партнёров снял\(а\) 3\s000\s₽ из копилки — выручка упала/).waitFor();
log("Команда: Боря вступил по ссылке, его взнос/снятие видны Ане в ленте");

// Chat: B writes to $PIG, A sees it
await B.page.getByRole("tab", { name: "Чат команды" }).click();
await B.page.getByLabel("Сообщение").fill("$PIG, что купить?");
await B.page.getByLabel("Отправить").click();
await B.page.getByTestId("biz-chat").getByText("$PIG, что купить?").waitFor();
const chatV = await A.view();
check(chatV.chat.some((c) => c.text === "$PIG, что купить?"), "A doesn't see B's chat");
check(chatV.chat.at(-1)?.pig, "$PIG didn't answer");
log("Чат команды + ответ $PIG");

// Free plan: founder + 1 friend
const C = await user("Вика Лишняя", "c");
const joinC = await C.page.request.post(BASE + "/api/biz/join", { data: { code: invite.trim().split("/").pop() } });
check(joinC.status() === 409, `3rd member on Free → ${joinC.status()}`);
// IDOR: an outsider can't manage A's team or read it
const kick = await C.page.request.post(BASE + "/api/biz/members", { data: { action: "kick", userId: teamV.members[1].userId } });
check(kick.status() === 404, `outsider kick → ${kick.status()}`);
const cView = await C.view();
check(cView === null, "outsider sees a business");
const bKick = await B.page.request.post(BASE + "/api/biz/members", { data: { action: "kick", userId: teamV.members[0].userId } });
check(bKick.status() === 403, `member kicking founder → ${bKick.status()}`);
const anon = await (await browser.newContext()).request.get(BASE + "/api/biz");
check(anon.status() === 401, `anonymous GET → ${anon.status()}`);
const badCode = await C.page.request.post(BASE + "/api/biz/join", { data: { code: "x" } });
check(badCode.status() === 422, `bad invite code → ${badCode.status()}`);
log("Лимит Free, IDOR и авторизация");

// ── Team caps by the founder's plan: Free 2, Pro 4, Pro 7, Pro 10; a downgrade keeps members but blocks joins ──
const code = invite.trim().split("/").pop();
const aId = teamV.members.find((m) => m.you).userId;
const setPlan = (tier, active = true) => sql(`UPDATE "Profile" SET "proUntil" = ${active ? "now() + interval '30 days'" : "NULL"}, "proTier" = ${tier ? `'${tier}'` : "NULL"} WHERE "userId" = '${aId}'`);
setPlan("pro");
check((await A.view()).business.maxMembers === 4, "Pro cap != 4");
const joinC2 = await C.page.request.post(BASE + "/api/biz/join", { data: { code } });
check(joinC2.ok(), `3rd member on Pro → ${joinC2.status()}`);
setPlan("pro7");
check((await A.view()).business.maxMembers === 7, "Pro 7 cap != 7");
setPlan("pro10");
check((await A.view()).business.maxMembers === 10, "Pro 10 cap != 10");
setPlan(null, false); // downgrade to Free with 3 people
const D = await user("Дима Поздний", "d");
const joinD = await D.page.request.post(BASE + "/api/biz/join", { data: { code } });
check(joinD.status() === 409, `join over cap after downgrade → ${joinD.status()}`);
const down = await A.view();
check(down.members.length === 3 && down.business.maxMembers === 2, `after downgrade members ${down.members.length}, cap ${down.business.maxMembers}`);
check((await C.page.request.post(BASE + "/api/biz/leave")).ok(), "C leave failed");
const plans = await Promise.all(["month7", "year10", "bogus"].map((plan) => A.page.request.post(BASE + "/api/billing/checkout", { data: { plan } })));
check(plans[0].status() === 503 && plans[1].status() === 503 && plans[2].status() === 422, `checkout tiers → ${plans.map((r) => r.status())}`);
await A.page.goto(BASE + "/pro");
await A.page.getByTestId("tier-picker").getByRole("radio", { name: /Pro 10/ }).click();
await A.page.getByTestId("tier-picker").getByText("до 10 человек").first().waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz-1440-pro-tiers.png`, fullPage: false });
log("Лимиты команды: Free 2 / Pro 4 / Pro 7 / Pro 10, даунгрейд не выгоняет, но блокирует вступление");

// ── Concurrency: parallel buys can't overspend ──
await A.entry(6000); // capital 8000
const items = ["tables", "machine", "showcase", "menu", "chairs"]; // chairs is broken → 409; others compete for 8000
const rs = await Promise.all([...items, "tables", "tables"].map((itemId) => A.page.request.post(BASE + "/api/biz/buy", { data: { itemId } })));
const okCount = rs.filter((r) => r.ok()).length;
const cv = await A.view();
check(cv.business.capital >= 0, "capital went negative");
const spent = cv.owned.filter((o) => ["tables", "machine", "showcase", "menu"].includes(o.itemId)).length;
check(okCount === spent, `ok responses ${okCount} != new upgrades ${spent}`);
const priced = { tables: 2500, machine: 6000, showcase: 4000 };
const total = cv.owned.reduce((s, o) => s + (priced[o.itemId] ?? 0), 0);
check(8000 - total === cv.business.capital, `capital ${cv.business.capital} != 8000 - ${total}`);
log("Параллельные покупки", `${okCount} успешных, капитал ${cv.business.capital} ≥ 0, дублей нет`);

// ── Challenges: net deposits this week ──
const ch = (await A.view()).challenges;
const doable = ch.find((c) => c.progress >= c.target);
check(!!doable, "no completed challenge for A");
if (doable) {
  const r1 = await A.page.request.post(BASE + "/api/biz/challenges", { data: { id: doable.id } });
  const r2 = await A.page.request.post(BASE + "/api/biz/challenges", { data: { id: doable.id } });
  check(r1.ok() && r2.status() === 409, `challenge claim ${r1.status()} / ${r2.status()}`);
}
const big = await B.page.request.post(BASE + "/api/biz/challenges", { data: { id: "bigweek" } }); // B saved net 2 000 ₽
check(big.status() === 409, `unfinished challenge → ${big.status()}`);
log("Челленджи: засчитываются только реальные взносы");

// ── Leaderboard ──
await A.page.goto(BASE + "/biz/top");
await A.page.getByTestId("biz-top").getByText("Кофейня Аня").first().waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz-1440-top.png`, fullPage: true });
log("Лидерборд бизнесов");

await A.page.goto(BASE + "/biz");
await A.page.getByTestId("biz-capital").waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz-1440-team.png`, fullPage: true });

// Mobile
const M = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light", storageState: await A.ctx.storageState() });
const mp = await M.newPage();
mp.on("pageerror", (e) => problems.push(`[m] pageerror: ${e.message}`));
await mp.goto(BASE + "/biz");
await mp.getByTestId("biz-capital").waitFor();
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 1, `mobile horizontal overflow ${overflow}px`);
await mp.screenshot({ path: `${SHOTS}/biz-390.png`, fullPage: true });
await mp.goto(BASE + "/dashboard");
await mp.getByTestId("biz-dash").waitFor();
await mp.screenshot({ path: `${SHOTS}/biz-390-dashboard.png` });
await mp.goto(BASE + "/biz/top");
await mp.screenshot({ path: `${SHOTS}/biz-390-top.png`, fullPage: true });
log("Мобильная версия 390px");

// Leave: B leaves, then A closes
check((await B.page.request.post(BASE + "/api/biz/leave")).ok(), "B leave failed");
check((await A.view()).members.length === 1, "B still a member");
log("Выход из бизнеса");

await browser.close();
if (problems.length) {
  console.log("\nПРОБЛЕМЫ:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nВсё ок");
