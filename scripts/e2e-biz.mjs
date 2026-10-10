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
  sql(`DELETE FROM "RateHit" WHERE key LIKE 'register:%'`); // other suites share 127.0.0.1 and the hourly signup limit
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
await A.page.getByTestId("kind-coffee").click();
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
check(!chatV.pigPartner && !chatV.chat.some((c) => c.pig), "$PIG answered in a Free team chat");
await B.page.getByTestId("pig-lock").first().waitFor();
// $PIG-партнёр in the team chat is a Pro feature of the founder
const founderId = chatV.members.find((m) => m.you).userId;
sql(`UPDATE "Profile" SET "proUntil" = now() + interval '30 days', "proTier" = 'pro' WHERE "userId" = '${founderId}'`);
await B.page.request.post(BASE + "/api/biz/chat", { data: { text: "$PIG, что купить?" } });
const chatP = await A.view();
check(chatP.pigPartner && chatP.chat.at(-1)?.pig, "$PIG didn't answer in a Pro team chat");
sql(`UPDATE "Profile" SET "proUntil" = NULL, "proTier" = NULL WHERE "userId" = '${founderId}'`);
log("Чат команды: в Free $PIG молчит (замок «$PIG-партнёр доступен в Pro»), в Pro отвечает");

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

// ── Challenges: only deposits confirmed by a bank screenshot count (lib/savings/proof.ts) ──
check(!(await A.view()).challenges.some((c) => c.progress >= c.target), "unconfirmed deposits completed a challenge");
const confirmAll = (userId) =>
  sql(`INSERT INTO "DepositProof" (id, "entryId", "userId", amount, status, "imageHash") SELECT 'e2e' || e.id, e.id, g."userId", e.amount, 'confirmed', 'e2e-' || e.id FROM "SavingsEntry" e JOIN "SavingsGoal" g ON g.id = e."goalId" WHERE g."userId" = '${userId}' AND e.amount > 0 ON CONFLICT DO NOTHING`);
confirmAll(aId);
confirmAll(teamV.members.find((m) => !m.you).userId);
const ch = (await A.view()).challenges;
const doable = ch.find((c) => c.progress >= c.target);
check(!!doable, "no completed challenge for A");
if (doable) {
  // «Выполнил» only sends the proof to review; a second send while pending → 409
  const r1 = await A.page.request.post(BASE + "/api/biz/challenges", { data: { id: doable.id, text: "Неделю готовила дома, отложила разницу" } });
  const r2 = await A.page.request.post(BASE + "/api/biz/challenges", { data: { id: doable.id, text: "Неделю готовила дома, отложила разницу" } });
  check(r1.ok() && (await r1.json()).status === "pending" && r2.status() === 409, `challenge submit ${r1.status()} / ${r2.status()}`);
  check((await A.view()).challenges.find((c) => c.id === doable.id).status === "pending", "challenge not «на проверке»");
}
const big = await B.page.request.post(BASE + "/api/biz/challenges", { data: { id: "bigweek", text: "Отложил всё, что смог за неделю" } }); // B saved net 2 000 ₽
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


// ════════════════ PìgBiz 2: admin-reviewed challenges, story, crises, investors, types, Pro custom ════════════════
const bizId = (await A.view()).business.id;
const bId = teamV.members.find((m) => !m.you).userId;
const ADM = await user("Модератор Маша", "adm");
const admId = sql(`SELECT id FROM "User" WHERE email = 'biz+${stamp}adm@pigsen.test'`);
sql(`INSERT INTO "AdminGrant" ("userId") VALUES ('${admId}') ON CONFLICT DO NOTHING`);
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const subId = (src, ch, uid) => sql(`SELECT id FROM "ChallengeSubmission" WHERE source='${src}' AND "challengeId"='${ch}' AND "userId"='${uid}' ORDER BY "createdAt" DESC LIMIT 1`);
const review = (id, action, comment = "") => ADM.page.request.post(`${BASE}/api/admin/challenges/${id}`, { data: { action, comment } });

// Non-admins can't review
check((await A.page.request.post(`${BASE}/api/admin/challenges/${subId("biz", doable.id, aId)}`, { data: { action: "approve" } })).status() === 404, "non-admin review not 404");
// Admin approves A's proof in the admin panel UI
await ADM.page.goto(BASE + "/admin/challenges");
const row = ADM.page.getByTestId(`chs-${subId("biz", doable.id, aId)}`);
await row.waitFor();
await ADM.page.screenshot({ path: `${SHOTS}/biz2-1440-admin-challenges.png`, fullPage: true });
await row.getByRole("button", { name: "Одобрить" }).click();
await row.waitFor({ state: "detached" });
const itemA = { nodelivery: "ch-no-delivery", nocoffee: "ch-home-coffee", nosubs: "ch-no-subs", bigweek: "ch-big-week" }[doable.id];
const afterApprove = await B.view(); // teammate sees it in the shared business
check(afterApprove.owned.some((o) => o.itemId === itemA), `approved item ${itemA} not in team business`);
check(afterApprove.catalog.find((c) => c.id === itemA)?.challenge && afterApprove.scene.challengeItems.includes(itemA), "challenge item not flagged for the scene");
check(afterApprove.events.some((e) => e.kind === "challenge" && e.text.includes("одобрен")), "no feed entry for approval");
const dupTeam = await B.page.request.post(BASE + "/api/biz/challenges", { data: { id: doable.id, text: "Я тоже выполнил этот челлендж" } });
check(dupTeam.status() === 409, `teammate re-submit of an approved team challenge → ${dupTeam.status()}`);
check((await A.page.request.post(BASE + "/api/biz/buy", { data: { itemId: itemA } })).status() === 409, "challenge item could be bought");
log("Челлендж: «Выполнил» → на проверке → админ одобрил в /admin/challenges", `предмет «${itemA}» в общем бизнесе, повтор командой → 409, купить нельзя`);

// Reject → resubmit → approve (B, with a photo)
const bs1 = await B.page.request.post(BASE + "/api/biz/challenges", { data: { id: "nosubs", text: "Отменил подписку на кино, 400 ₽ отложил", image: PNG } });
check(bs1.ok(), `B submit nosubs → ${bs1.status()} ${await bs1.text()}`);
const bSub1 = subId("biz", "nosubs", bId);
check((await ADM.page.request.get(`${BASE}/api/challenges/proofs/${bSub1}/image`)).ok(), "admin can't see the proof photo");
check((await C.page.request.get(`${BASE}/api/challenges/proofs/${bSub1}/image`)).status() === 404, "outsider sees the proof photo");
check((await review(bSub1, "reject")).status() === 422, "reject without a comment allowed");
check((await review(bSub1, "reject", "Не видно, что подписка отменена")).ok(), "reject failed");
const rej = (await B.view()).challenges.find((c) => c.id === "nosubs");
check(rej.status === "rejected" && rej.comment.includes("подписка"), `rejected state ${JSON.stringify(rej)}`);
await B.page.goto(BASE + "/biz");
await B.page.getByTestId("bch-nosubs").getByText("Не принято").waitFor();
await B.page.getByTestId("bch-nosubs").getByRole("button", { name: "Отправить ещё раз" }).click();
await B.page.getByTestId("bch-nosubs").getByLabel("Описание").fill("Вот скрин отмены подписки, 400 ₽ в копилке");
await B.page.getByTestId("bch-nosubs").getByRole("button", { name: "Отправить на проверку" }).click();
await B.page.getByTestId("bch-nosubs").getByTestId("bch-pending").waitFor();
const bSub2 = subId("biz", "nosubs", bId);
check(bSub2 !== bSub1, "resubmit didn't create a new proof");
const [ap1, ap2] = await Promise.all([review(bSub2, "approve"), review(bSub2, "approve")]); // race: only one wins
const apOk = [ap1, ap2].filter((r) => r.ok());
check(apOk.length === 1 && [ap1, ap2].some((r) => r.status() === 409), `parallel approvals ${ap1.status()}/${ap2.status()}`);
const apBody = await apOk[0].json();
check(apBody.status === "approved" && apBody.coins === 6 && apBody.itemId === "ch-no-subs", `approve body ${JSON.stringify(apBody)}`);
check(sql(`SELECT count(*) FROM "BizUpgrade" WHERE "businessId"='${bizId}' AND "itemId"='ch-no-subs'`) === "1", "ch-no-subs not granted exactly once");
log("Отказ с причиной → повторная отправка из UI → одобрение", `B: +${apBody.coins} PigCoin$, «ch-no-subs» выдан один раз (2 параллельных одобрения → 1 ок + 409)`);

// Offline challenge (/challenges) → admin approve → unique item in the user's business
const so = await A.page.request.post(BASE + "/api/challenges/spend-notebook/complete", { data: { note: "Неделю записывала траты, больше всего на кафе" } });
check(so.ok(), `social submit → ${so.status()}`);
await A.page.goto(BASE + "/challenges");
await A.page.getByTestId("challenge-pending").first().waitFor();
const soAp = await (await review(subId("social", "spend-notebook", aId), "approve")).json();
check(soAp.status === "approved" && soAp.coins === 80 && soAp.granted, `social approve ${JSON.stringify(soAp)}`);
check((await A.view()).owned.some((o) => o.itemId === "ch-spend-notebook"), "social item not in business");
check(sql(`SELECT count(*) FROM "ChallengeDone" WHERE "userId"='${aId}' AND "challengeId"='spend-notebook'`) === "1", "ChallengeDone not recorded");
check((await A.page.request.post(BASE + "/api/challenges/spend-notebook/complete", { data: { note: "Ещё раз записала все траты" } })).status() === 409, "social re-submit after approval");
log("Офлайн-челлендж: на проверке → одобрен", `+${soAp.coins} PigCoin$, предмет «ch-spend-notebook» в бизнесе`);

// ── Story: chapter 1 «Открой точку» is done by owning an upgrade ──
let v = await A.view();
check(v.story.length === 7 && v.story[0].status === "ready", `story ch1 ${v.story[0]?.status}`);
await A.page.goto(BASE + "/biz");
await A.page.getByTestId("story-claim").click();
await A.page.getByTestId("story-ch-2").waitFor();
v = await A.view();
check(v.story[0].status === "done" && ["current", "ready"].includes(v.story[1].status), "story didn't advance");
check(v.events.some((e) => e.kind === "story" && e.text.includes("+10 PigCoin$")), "no story feed entry");
check((await B.view()).story[0].status === "done", "teammate doesn't see story progress");
log("История: глава 1 «Открой точку» пройдена (+10 PigCoin$, +10 XP каждому), глава 2 открыта");

// ── Crisis: 6 missed days → a scripted crisis (deterministic), team-wide ──
const ratingBeforeDays = v.business.rating;
sql(`UPDATE "BizBusiness" SET "lastDay" = to_char((now() at time zone 'utc') - interval '6 days', 'YYYY-MM-DD') WHERE id = '${bizId}'`);
v = await A.view();
check(!!v.crisis, `no crisis after 6 days (day ${v.business.dayNo})`);
const vb = await B.view();
check(vb.crisis?.id === v.crisis?.id, "teammate sees another crisis");
check(typeof v.scene.mood === "number" && v.scene.guests === v.business.today.guests && Array.isArray(v.scene.items), "scene data missing");
await A.page.reload();
await A.page.getByTestId("biz-crisis").waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz2-1440-crisis.png`, fullPage: true });
const opt = v.crisis.options.find((o) => o.cost === 0);
const repBefore = v.business.reputation;
const cr = await B.page.request.post(BASE + "/api/biz/crisis", { data: { crisisId: v.crisis.id, optionId: opt.id } });
const crBody = await cr.json();
check(cr.ok() && crBody.outcome && !crBody.view.crisis, `crisis resolve ${cr.status()}`);
check(crBody.view.business.reputation === Math.max(0, Math.min(100, repBefore + crBody.outcome.reputation)), "reputation not applied");
check((await A.page.request.post(BASE + "/api/biz/crisis", { data: { crisisId: v.crisis.id, optionId: opt.id } })).status() === 409, "crisis resolved twice");
log(`Кризис «${v.crisis.title}» (день ${v.crisis.day})`, `Боря выбрал «${opt.label}» → ${crBody.outcome.good ? "успех" : "неудача"}: ${crBody.outcome.text}; рейтинг ${crBody.outcome.rating}, репутация ${crBody.outcome.reputation}; рейтинг до дней ${ratingBeforeDays}`);

// ── Investors: accept + win (real savings), accept + fail (deadline) ──
v = await A.view();
check(v.investors.offers.some((o) => o.id === "sonya") && v.investors.offers.some((o) => o.id === "oleg"), `offers ${v.investors.offers.map((o) => o.id)}`);
check((await B.page.request.post(BASE + "/api/biz/investors", { data: { investorId: "sonya", action: "accept" } })).status() === 403, "member accepted a deal");
check((await A.page.request.post(BASE + "/api/biz/investors", { data: { investorId: "sonya", action: "accept" } })).ok(), "accept sonya failed");
v = await A.view();
check(v.investors.deal?.id === "sonya" && v.investors.deal.progress.status === "active", "deal not active");
const capBeforeDeal = v.business.capital;
await A.entry(10000);
confirmAll(aId);
v = await A.view();
check(!v.investors.deal && v.investors.history.some((h) => h.id === "sonya" && h.status === "won"), "sonya deal not won");
check(v.business.capital === capBeforeDeal + 10000, `investor created capital: ${v.business.capital} vs ${capBeforeDeal + 10000}`);
check(v.business.boost.discount === 0.1 && v.business.equity === 0.08, `boost ${JSON.stringify(v.business.boost)} equity ${v.business.equity}`);
const disc = v.catalog.find((c) => c.state === "open" && c.basePrice >= 1000);
check(disc && disc.price === Math.round(disc.basePrice * 0.9), "discount not applied to prices");
log("Инвестор Соня Сейвина: 10 000 ₽ за 7 дней", `сделка закрыта, −10% к ценам (${disc?.basePrice} → ${disc?.price}), доля 8% игровой прибыли, капитал = только взносы`);
check((await A.page.request.post(BASE + "/api/biz/investors", { data: { investorId: "oleg", action: "accept" } })).ok(), "accept oleg failed");
const pre = (await A.view()).business;
sql(`UPDATE "BizBusiness" SET state = jsonb_set(jsonb_set(state::jsonb, '{deal,acceptedAt}', to_jsonb(to_char((now() at time zone 'utc') - interval '8 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), '{deal,deadline}', to_jsonb(to_char((now() at time zone 'utc') - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) WHERE id = '${bizId}'`);
v = await A.view();
check(v.investors.history.some((h) => h.id === "oleg" && h.status === "failed"), "oleg deal not failed");
check(v.business.reputation === Math.max(0, pre.reputation - 15), `reputation ${pre.reputation} → ${v.business.reputation}`);
check(Math.abs(v.business.rating - Math.max(1, pre.rating - 0.2)) < 0.011, `rating ${pre.rating} → ${v.business.rating}`);
check(v.events.some((e) => e.kind === "investor-fail"), "no fail event");
await A.page.reload();
await A.page.getByTestId("biz-investors").waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz2-1440-investors.png`, fullPage: true });
log("Инвестор Олег Капустин: 4 недели по 3 000 ₽ — провал по сроку", `репутация ${pre.reputation} → ${v.business.reputation}, рейтинг ${pre.rating} → ${v.business.rating}`);

// ── Catalog API: every type has 15–25 items with stable kebab ids ──
const cat = (await (await A.page.request.get(BASE + "/api/biz/catalog")).json()).types;
check(cat.length === 15, `types ${cat.length}`);
for (const t of cat) {
  const own = t.items.filter((i) => !i.challenge);
  check(own.length >= 15 && own.length <= 25, `${t.kind}: ${own.length} items`);
  check(t.items.every((i) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(i.id) && i.slot && i.category), `${t.kind}: bad ids/slots`);
}
check(cat.find((t) => t.kind === "coffee").items.some((i) => i.id === "chairs" && i.name === "Стулья"), "coffee ids changed");
log("Каталог /api/biz/catalog", cat.map((t) => `${t.title} ${t.items.filter((i) => !i.challenge).length}`).join(", "));

// ── Switch to an IT business (founder only, confirm dialog); team follows ──
check((await B.page.request.post(BASE + "/api/biz/switch", { data: { kind: "saas", name: "Боря захватил" } })).status() === 403, "member switched the business");
const capBeforeSwitch = (await A.view()).business.capital;
await A.page.goto(BASE + "/biz");
await A.page.getByTestId("biz-switch-open").click();
await A.page.getByRole("dialog").getByRole("button", { name: /SaaS-стартап/ }).click();
await A.page.getByRole("dialog").getByLabel("Название").fill("Облако Ани");
await A.page.getByTestId("biz-switch-confirm").click();
await A.page.getByRole("heading", { name: /Облако Ани/ }).waitFor();
v = await B.view();
check(v.business.kind === "saas" && v.business.template === "it" && v.business.name === "Облако Ани", `B sees ${v.business.kind}`);
check(v.business.capital === capBeforeSwitch, `capital changed on switch ${capBeforeSwitch} → ${v.business.capital}`);
check(v.owned.every((o) => o.itemId.startsWith("ch-")) && v.owned.length === 3, `owned after switch ${v.owned.map((o) => o.itemId)}`);
check(v.business.today.churn > 0 && v.business.today.bugs > 0 && v.business.labels.guests === "Активных клиентов", "IT metrics missing");
check(v.story[0].status !== "done" && !v.investors.history.length, "story/investors not reset");
const bugsBefore = v.business.today.bugs;
await A.entry(8000);
check((await A.page.request.post(BASE + "/api/biz/buy", { data: { itemId: "saas-laptops" } })).ok(), "buy saas-laptops");
check((await A.page.request.post(BASE + "/api/biz/buy", { data: { itemId: "saas-qa" } })).ok(), "buy saas-qa");
v = await A.view();
check(v.business.capital === capBeforeSwitch + 8000 - 6000 - 8000, `IT buys capital ${v.business.capital}`);
check(v.business.today.bugs === bugsBefore - 5, `bugs ${bugsBefore} → ${v.business.today.bugs}`);
await A.page.reload();
await A.page.getByTestId("biz-capital").waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz2-1440-it.png`, fullPage: true });
log("Смена типа → SaaS-стартап (диалог подтверждения)", `капитал ${capBeforeSwitch} сохранён, челлендж-предметы остались, багов ${bugsBefore} → ${v.business.today.bugs} после QA, Боря видит то же`);

// ── Pro «Свой бизнес»: locked on Free, works on Pro ──
await A.page.getByTestId("biz-custom-locked").waitFor();
const custom = { emoji: "🚀", accent: "#0b7a4b", names: { "saas-laptops": "Макбуки команды" } };
check((await A.page.request.post(BASE + "/api/biz/custom", { data: custom })).status() === 402, "custom on Free");
setPlan("pro");
check((await A.page.request.post(BASE + "/api/biz/custom", { data: { ...custom, emoji: "💣" } })).status() === 422, "bad emoji accepted");
check((await A.page.request.post(BASE + "/api/biz/custom", { data: custom })).ok(), "custom on Pro failed");
v = await B.view();
check(v.business.emoji === "🚀" && v.business.accent === "#0b7a4b" && v.catalog.find((c) => c.id === "saas-laptops").title === "Макбуки команды", "custom not visible to the team");
await A.page.reload();
await A.page.getByTestId("biz-custom").waitFor();
await A.page.screenshot({ path: `${SHOTS}/biz2-1440-custom.png`, fullPage: true });
setPlan(null, false);
log("Свой бизнес (Pro): логотип 🚀, оттенок #0b7a4b, «Ноутбуки» → «Макбуки команды»; Free → 402");

// New user: start screen shows all types + locked custom; opens a bakery; Pro user opens a custom web studio
const F = await user("Фёдор Пекарев", "f");
await F.page.goto(BASE + "/biz");
await F.page.getByTestId("kind-bakery").click();
await F.page.getByTestId("custom-biz").getByText("Открыть в Pro").waitFor();
await F.page.screenshot({ path: `${SHOTS}/biz2-1440-start.png`, fullPage: true });
await F.page.getByRole("button", { name: "Открыть бизнес" }).click();
await F.page.getByTestId("biz-capital").waitFor();
check((await F.view()).business.kind === "bakery", "bakery not created");
const fId = sql(`SELECT id FROM "User" WHERE email = 'biz+${stamp}f@pigsen.test'`);
sql(`UPDATE "Profile" SET "proUntil" = now() + interval '30 days', "proTier" = 'pro' WHERE "userId" = '${fId}'`);
check((await F.page.request.post(BASE + "/api/biz/leave")).ok(), "F leave");
const fc = await F.page.request.post(BASE + "/api/biz", { data: { kind: "webstudio", name: "Студия Феди", custom: { emoji: "🎨", accent: "#3fbf7f" } } });
check(fc.status() === 201 && (await fc.json()).view.business.emoji === "🎨", `custom create ${fc.status()}`);
const fm = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await F.ctx.storageState() });
const fp = await fm.newPage();
await fp.goto(BASE + "/biz");
await fp.getByTestId("biz-capital").waitFor();
check((await fp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, "mobile overflow on web studio");
await fp.screenshot({ path: `${SHOTS}/biz2-390-webstudio.png`, fullPage: true });
log("Старт: пекарня (Free, «Свой бизнес» под замком), веб-студия с логотипом 🎨 (Pro)");

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
