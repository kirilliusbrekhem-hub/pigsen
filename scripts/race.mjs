// Concurrency check: 20 parallel requests must pay out once (or up to the cap).
// Usage: BASE_URL=... DATABASE_URL=... node scripts/race.mjs
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const problems = [];
const ok = (s) => console.log(`✓ ${s}`);
const N = 20;

async function newUser(tag) {
  const email = `race-${tag}+${Date.now()}@pigsen.test`;
  const reg = await fetch(BASE + "/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Гонка", email, password: "supersecret1", accept: true }),
  });
  if (reg.status !== 201) throw new Error(`register ${reg.status} ${await reg.text()}`);
  const cookie = reg.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const user = await prisma.user.findUnique({ where: { email } });
  const post = (path, body) =>
    fetch(BASE + path, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.status);
  return { user, post };
}
// The shop route allows 10 requests a minute per user, so each shop burst uses its own account.
let { user, post } = await newUser("chest");
const users = [user.id];
const burst = (fn) => Promise.all(Array.from({ length: N }, fn));

// Chest: at most 3 per day, coins never go negative.
await prisma.profile.update({ where: { userId: user.id }, data: { coins: 10_000 } });
const chest = await burst(() => post("/api/shop/buy", { itemId: "chest" }));
const chests = await prisma.coinTx.count({ where: { userId: user.id, reason: "shop:chest" } });
const prizes = await prisma.coinTx.count({ where: { userId: user.id, reason: "chest" } });
if (chests !== 3 || prizes !== 3) problems.push(`chest: ${chests} bought, ${prizes} prizes (statuses ${chest.join(",")})`);
else ok(`Chest: 3 of ${N} succeeded`);

// Streak freeze: at most 3 held.
({ user, post } = await newUser("freeze"));
users.push(user.id);
await prisma.profile.update({ where: { userId: user.id }, data: { coins: 10_000 } });
const freeze = await burst(() => post("/api/shop/buy", { itemId: "streak-freeze" }));
const fp = await prisma.profile.findUnique({ where: { userId: user.id } });
if (fp.streakFreezes > 3) problems.push(`streak freezes ${fp.streakFreezes} (statuses ${freeze.join(",")})`);
else if (fp.streakFreezes < 3) problems.push(`streak freezes only ${fp.streakFreezes}`);
else ok("Streak freeze: exactly 3 held");

// Lesson completion: XP once.
const lesson = await prisma.lesson.findFirst({ where: { order: 1, course: { contentItem: { premium: false } } } });
const before = (await prisma.profile.findUnique({ where: { userId: user.id } })).xp;
const lc = await burst(() => post(`/api/lessons/${lesson.id}/complete`));
const after = (await prisma.profile.findUnique({ where: { userId: user.id } })).xp;
const xpTx = await prisma.coinTx.count({ where: { userId: user.id, reason: "xp" } });
if (lc.some((s) => s !== 200) || xpTx !== 1) problems.push(`lesson: xp ${before}→${after}, xp payouts ${xpTx}, statuses ${lc.join(",")}`);
else ok(`Lesson complete: one payout of ${after - before} XP`);

// Daily bonus: once.
const db = await burst(() => post("/api/coins/daily"));
const daily = await prisma.coinTx.count({ where: { userId: user.id, reason: "daily" } });
if (daily !== 1) problems.push(`daily bonus paid ${daily} times (statuses ${db.join(",")})`);
else ok("Daily bonus: paid once");

await prisma.user.deleteMany({ where: { id: { in: users } } });
await prisma.$disconnect();
if (problems.length) {
  console.error("PROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("race: all good");
