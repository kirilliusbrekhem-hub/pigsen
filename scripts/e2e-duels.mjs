// E2E for Duels: friend duel with stake (two browser contexts), anti-cheat, escrow concurrency, ghost fallback, rematch, limits.
// Usage: BASE_URL=... DATABASE_URL=... SHOTS=dir node scripts/e2e-duels.mjs
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "/mnt/project-files/pigsen-shots";
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

async function newUser(label, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => problems.push(`[${label}] pageerror ${e.message}`));
  p.on("response", (r) => r.status() >= 500 && problems.push(`[${label}] HTTP ${r.status()} ${r.url()}`));
  const email = `duel-${label}+${Date.now()}@pigsen.test`;
  await p.goto(BASE + "/register");
  await p.getByLabel("Имя").fill(`Дуэлянт ${label}`);
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Пароль").fill("supersecret1");
  await p.getByLabel(/Мне есть 18/).check();
  await p.getByRole("button", { name: "Зарегистрироваться" }).click();
  await p.waitForURL("**/new");
  await p.goto(BASE + "/dashboard");
  const u = await prisma.user.findUnique({ where: { email } });
  await prisma.adminGrant.create({ data: { userId: u.id } }); // harmless now that duels are public; kept per original brief
  await prisma.profile.update({ where: { userId: u.id }, data: { coins: 1000 } });
  return { p, u };
}
const api = (p, url, body) => p.evaluate(async ([url, body]) => {
  const r = await fetch(url, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}, [url, body]);
const coins = async (id) => (await prisma.profile.findUnique({ where: { userId: id } })).coins;
/** Net PigCoin$ moved by duels (the dashboard's daily bonus may land at any time, so balances are checked via the ledger). */
const duelNet = async (id) => (await prisma.coinTx.aggregate({ where: { userId: id, reason: { startsWith: "duel:" } }, _sum: { amount: true } }))._sum.amount ?? 0;
const answersOf = async (duelId) => JSON.parse((await prisma.duel.findUnique({ where: { id: duelId } })).questions).map((q) => q.answer);

/** Plays all 7 questions through the UI. `pick(i, answer)` returns which option to click. */
async function playUi(p, duelId, pick, shot) {
  const answers = await answersOf(duelId);
  await p.getByTestId("duel-play").click();
  for (let i = 0; i < 7; i++) {
    await p.getByTestId("duel-question").waitFor();
    await p.waitForFunction((n) => document.querySelector(".duel-play-head .label")?.textContent?.includes(`Вопрос ${n}`), i + 1);
    if (i === 2 && shot) await p.screenshot({ path: `${SHOTS}/duels-${shot}.png` });
    await p.getByTestId("duel-option").nth(pick(i, answers[i])).click();
    await p.waitForSelector(".duel-option.right");
  }
  await p.getByTestId("duel-result").waitFor({ timeout: 15_000 });
}

await prisma.$executeRawUnsafe(`DELETE FROM "RateHit"`);
const A = await newUser("a");
const B = await newUser("b", 360);

// Lobby + friend duel with a 50 stake
await A.p.goto(BASE + "/duels");
await A.p.getByRole("heading", { name: "Дуэли" }).waitFor();
await A.p.getByRole("radio", { name: "50 PigCoin$" }).click();
await A.p.screenshot({ path: `${SHOTS}/duels-lobby.png`, fullPage: true });
await A.p.getByTestId("duel-friend").click();
await A.p.waitForURL(/\/duels\/c/);
const duelId = A.p.url().split("/duels/")[1];
const invite = (await A.p.getByTestId("duel-invite").textContent()).trim();
check(invite.startsWith("/duels/j/"), `invite link ${invite}`);
check((await duelNet(A.u.id)) === -50, `A escrow: ${await duelNet(A.u.id)}`);
await A.p.screenshot({ path: `${SHOTS}/duels-invite.png`, fullPage: true });
ok(`Friend duel created, 50 escrowed, invite ${invite}`);

// Server never sends the correct answer with the question
const q0 = await api(A.p, `/api/duels/${duelId}/question`, {});
check(q0.status === 200 && !("answer" in q0.body) && q0.body.options.length === 4, `question leak ${JSON.stringify(q0.body)}`);
// Anti-cheat: parallel answers to one question → exactly one accepted
const correct = await answersOf(duelId);
const burst = await Promise.all(Array.from({ length: 6 }, () => api(A.p, `/api/duels/${duelId}/answer`, { index: 0, choice: correct[0] })));
check(burst.filter((r) => r.status === 200).length === 1, `parallel answers accepted: ${burst.map((r) => r.status)}`);
check(burst.find((r) => r.status === 200)?.body.correct === true, "answer 0 should be correct");
// Answering ahead of the served question is refused
const ahead = await api(A.p, `/api/duels/${duelId}/answer`, { index: 3, choice: 0 });
check(ahead.status === 409, `answer ahead ${ahead.status}`);
// Late answer: question served, clock moved back 20 s → zero points
await api(A.p, `/api/duels/${duelId}/question`, {});
await prisma.duelPlayer.updateMany({ where: { duelId, userId: A.u.id }, data: { qStartedAt: new Date(Date.now() - 20_000) } });
const late = await api(A.p, `/api/duels/${duelId}/answer`, { index: 1, choice: correct[1] });
check(late.status === 200 && late.body.late === true && late.body.points === 0, `late answer ${JSON.stringify(late.body)}`);
ok("Anti-cheat: no answer leak, one answer per question, late answers score 0");

// A finishes the rest through the UI, always correct
await A.p.reload();
await A.p.getByTestId("duel-play").waitFor();
const answersA = await answersOf(duelId);
await A.p.getByTestId("duel-play").click();
for (let i = 2; i < 7; i++) {
  await A.p.waitForFunction((n) => document.querySelector(".duel-play-head .label")?.textContent?.includes(`Вопрос ${n}`), i + 1);
  if (i === 3) await A.p.screenshot({ path: `${SHOTS}/duels-play.png` });
  await A.p.getByTestId("duel-option").nth(answersA[i]).click();
  await A.p.waitForSelector(".duel-option.right");
}
await A.p.getByTestId("duel-result").waitFor({ timeout: 15_000 });
await A.p.getByText("Ждём соперника").first().waitFor();
ok("A finished, waiting for opponent");

// B accepts via invite link; parallel joins charge once
await B.p.goto(BASE + invite);
await B.p.getByTestId("duel-accept").waitFor();
await B.p.screenshot({ path: `${SHOTS}/duels-join-mobile.png`, fullPage: true });
const code = invite.split("/").pop();
const joins = await Promise.all(Array.from({ length: 5 }, () => api(B.p, "/api/duels/join", { code })));
check(joins.every((r) => r.status === 200), `parallel joins: ${joins.map((r) => r.status)}`);
check((await duelNet(B.u.id)) === -50, `B charged once: ${await duelNet(B.u.id)}`);
check((await prisma.duelPlayer.count({ where: { duelId } })) === 2, "two players");
await B.p.goto(`${BASE}/duels/${duelId}`);
await playUi(B.p, duelId, (i, a) => (i < 2 ? a : (a + 1) % 4), "play-mobile");
await B.p.getByText("Поражение").waitFor();
await B.p.screenshot({ path: `${SHOTS}/duels-result-mobile.png`, fullPage: true });
check((await duelNet(A.u.id)) === 50, `A winnings: ${await duelNet(A.u.id)}`);
check((await duelNet(B.u.id)) === -50, `B after loss: ${await duelNet(B.u.id)}`);
await A.p.reload();
await A.p.getByText("Победа!").waitFor();
await A.p.screenshot({ path: `${SHOTS}/duels-result.png`, fullPage: true });
ok("Friend duel settled: A wins 100 (both stakes), B loses 50");

// Rematch: A proposes, B accepts the same duel
await A.p.getByTestId("duel-rematch").click();
await A.p.waitForURL((u) => !u.pathname.endsWith(duelId));
const remId = A.p.url().split("/duels/")[1];
await B.p.reload();
await B.p.getByRole("button", { name: "Принять реванш" }).click();
await B.p.waitForURL(`**/duels/${remId}`);
check((await prisma.duelPlayer.count({ where: { duelId: remId } })) === 2, "rematch has both players");
ok("Rematch: both players in the same new duel");

// Free limit: B (free) has played 2 today → third ok, fourth refused
const third = await api(B.p, "/api/duels", { mode: "friend", stake: 0 });
const fourth = await api(B.p, "/api/duels", { mode: "friend", stake: 0 });
check(third.status === 201 && fourth.status === 429, `free limit: ${third.status} ${fourth.status}`);
ok("Free plan: 3 duels/day");

// Escrow concurrency: Pro user with 120 PigCoin$ fires 8 parallel 50-stake duels → exactly 2 succeed, balance 20
const C = await newUser("c");
await prisma.profile.update({ where: { userId: C.u.id }, data: { coins: 120, proUntil: new Date(Date.now() + 86_400_000) } });
await prisma.$executeRawUnsafe(`DELETE FROM "RateHit"`);
const par = await Promise.all(Array.from({ length: 8 }, () => api(C.p, "/api/duels", { mode: "friend", stake: 50 })));
const won = par.filter((r) => r.status === 201).length;
const ledger = await prisma.coinTx.aggregate({ where: { userId: C.u.id, reason: "duel:stake" }, _sum: { amount: true } });
check(won === 2 && (await coins(C.u.id)) >= 0 && ledger._sum.amount === -100, `escrow race: ${won} ok, coins ${await coins(C.u.id)}, ledger ${ledger._sum.amount}`);
// Daily stake cap (300): top up and keep staking 100s
await prisma.profile.update({ where: { userId: C.u.id }, data: { coins: 1000 } });
const caps = [];
for (let i = 0; i < 3; i++) caps.push((await api(C.p, "/api/duels", { mode: "friend", stake: 100 })).status);
check(caps.join() === "201,201,429", `stake cap: ${caps}`);
ok(`Escrow race safe (${won}/8 succeeded, ledger -100); daily stake cap enforced`);

// Random → nobody waiting → ghost (A's or B's recorded run) with stake capped at 10
await prisma.$executeRawUnsafe(`DELETE FROM "RateHit"`);
const before = await coins(C.u.id);
const rnd = await api(C.p, "/api/duels", { mode: "random", stake: 0 });
await C.p.goto(`${BASE}/duels/${rnd.body.id}`);
await C.p.getByText("Ищем соперника").waitFor();
await C.p.screenshot({ path: `${SHOTS}/duels-search.png` });
await C.p.getByTestId("duel-play").waitFor({ timeout: 20_000 });
const g = await prisma.duel.findUnique({ where: { id: rnd.body.id }, include: { players: true } });
check(["ghost", "bot"].includes(g.kind) && g.players.length === 2, `fallback kind ${g.kind}`);
await playUi(C.p, rnd.body.id, (i, a) => a);
check((await coins(C.u.id)) >= before, "stake-free ghost duel changes nothing on loss");
ok(`Random fallback: played vs ${g.kind} (${g.players.find((p) => p.isBot).name})`);

// Unauthenticated API is refused
const anon = await (await browser.newContext()).newPage();
await anon.goto(BASE + "/login");
const an = await api(anon, "/api/duels");
check(an.status === 401, `anon ${an.status}`);

await A.p.goto(BASE + "/duels");
await A.p.getByText("Рейтинг недели").waitFor();
await A.p.screenshot({ path: `${SHOTS}/duels-lobby-after.png`, fullPage: true });

await browser.close();
await prisma.$disconnect();
if (problems.length) {
  console.error("PROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("ALL OK");
