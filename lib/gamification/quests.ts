import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { isPro } from "@/lib/billing/plan";
import { isUniqueViolation } from "@/lib/db/lock";
import { addCoins } from "@/lib/coins/service";
import { awardXp, type XpResult } from "@/lib/gamification/service";

/** Events that move quests. Hooks call `trackQuest(userId, kind)` as a one-liner; it never throws. */
export type QuestKind = "lesson" | "quiz" | "quiz_perfect" | "ask_pig" | "deposit" | "save" | "community";

interface QuestDef {
  kind: QuestKind;
  title: string;
  hint: string;
  href: string;
  icon: string;
  target: number;
  proOnly?: boolean;
}

/** Rewards are deliberately small: a lesson pays ~10 PigCoin$ on Free, a whole day of quests about the same as 3 lessons. */
export const QUEST_REWARD = {
  /** Each daily quest: XP only (XP also pays PigCoin$ at the usual rate: 10 XP = 5 coins on Free, 10 on Pro). */
  dailyXp: 10,
  /** "All 3 done" chest. */
  chestXp: 10,
  chestCoins: 10,
  /** Weekly quest. */
  weeklyXp: 40,
  weeklyCoins: 20,
} as const;

const POOL: QuestDef[] = [
  { kind: "lesson", title: "Пройди урок", hint: "Любой урок в разделе «Обучение»", href: "/learn", icon: "cap", target: 1 },
  { kind: "quiz", title: "Пройди квиз", hint: "Квиз внизу любого урока", href: "/learn", icon: "bulb", target: 1 },
  { kind: "quiz_perfect", title: "Ответь на квиз без ошибок", hint: "Все ответы верные", href: "/learn", icon: "sparkle", target: 1 },
  { kind: "ask_pig", title: "Задай вопрос CAP", hint: "Спроси о бизнесе или деньгах", href: "/ai", icon: "message", target: 1 },
  { kind: "deposit", title: "Внеси в копилку", hint: "Любая сумма в любую цель", href: "/savings", icon: "piggy", target: 1 },
  { kind: "save", title: "Сохрани материал", hint: "Закладка у статьи или книги", href: "/library", icon: "bookmark", target: 1 },
  { kind: "community", title: "Напиши в комьюнити", hint: "Пост или ответ", href: "/community", icon: "users", target: 1, proOnly: true },
];

const WEEKLY: QuestDef = { kind: "lesson", title: "Пройди 5 уроков за неделю", hint: "Неделя начинается в понедельник", href: "/learn", icon: "trophy", target: 5 };

/** Wheel of fortune, odds live only here. EV ≈ 2.2 PigCoin$ + 0.8 XP a day, well below the 5–15 daily login bonus. */
export const WHEEL: { label: string; coins: number; xp: number; weight: number }[] = [
  { label: "1 PigCoin$", coins: 1, xp: 0, weight: 30 },
  { label: "2 PigCoin$", coins: 2, xp: 0, weight: 25 },
  { label: "5 XP", coins: 0, xp: 5, weight: 15 },
  { label: "3 PigCoin$", coins: 3, xp: 0, weight: 18 },
  { label: "5 PigCoin$", coins: 5, xp: 0, weight: 10 },
  { label: "15 PigCoin$", coins: 15, xp: 0, weight: 2 },
];

const today = () => new Date().toISOString().slice(0, 10);
function weekStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const dayPeriod = () => `d:${today()}`;
const weekPeriod = () => `w:${weekStart()}`;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Today's 3 quests: always a lesson, plus two picked deterministically per user and day. */
export function dailyQuests(userId: string, pro: boolean, day = today()): QuestDef[] {
  const rest = POOL.filter((q) => q.kind !== "lesson" && (pro || !q.proOnly));
  let seed = hash(`${userId}:${day}`);
  const picked: QuestDef[] = [];
  while (picked.length < 2 && rest.length) {
    seed = hash(`${seed}`);
    picked.push(rest.splice(seed % rest.length, 1)[0]);
  }
  return [POOL[0], ...picked];
}

async function bump(userId: string, period: string, kind: string) {
  await prisma.$executeRaw`INSERT INTO "QuestProgress" ("userId", "period", "kind", "progress", "updatedAt") VALUES (${userId}, ${period}, ${kind}, 1, NOW())
    ON CONFLICT ("userId", "period", "kind") DO UPDATE SET "progress" = "QuestProgress"."progress" + 1, "updatedAt" = NOW()`;
}

/** Records one quest event. Atomic upsert-increment, so parallel events never lose a count. Never throws. */
export async function trackQuest(userId: string, kind: QuestKind): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
    const pro = isPro(profile);
    const jobs: Promise<unknown>[] = [];
    if (dailyQuests(userId, pro).some((q) => q.kind === kind)) jobs.push(bump(userId, dayPeriod(), kind));
    if (kind === WEEKLY.kind) jobs.push(bump(userId, weekPeriod(), kind));
    await Promise.all(jobs);
  } catch (e) {
    console.error("[quest] track failed", e instanceof Error ? e.message : e);
  }
}

export interface QuestView {
  id: string;
  title: string;
  hint: string;
  href: string;
  icon: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  rewardXp: number;
  rewardCoins: number;
}

export interface QuestBoard {
  daily: QuestView[];
  chest: { ready: boolean; claimed: boolean; xp: number; coins: number };
  weekly: QuestView;
  spin: { available: boolean; prizes: string[] };
  /** Seconds until the daily reset (UTC midnight). */
  resetIn: number;
}

export async function getQuestBoard(userId: string, pro: boolean): Promise<QuestBoard> {
  const dp = dayPeriod();
  const wp = weekPeriod();
  const [rows, claims] = await Promise.all([
    prisma.questProgress.findMany({ where: { userId, period: { in: [dp, wp] } } }),
    prisma.dailyClaim.findMany({ where: { userId, key: { startsWith: "quest:" }, createdAt: { gte: new Date(Date.now() - 8 * 86400_000) } }, select: { key: true } }),
  ]);
  const spun = await prisma.dailyClaim.findUnique({ where: { userId_key: { userId, key: `spin:${today()}` } } });
  const claimed = new Set(claims.map((c) => c.key));
  const prog = (period: string, kind: string) => rows.find((r) => r.period === period && r.kind === kind)?.progress ?? 0;
  const view = (q: QuestDef, period: string, xp: number, coins: number): QuestView => {
    const progress = Math.min(q.target, prog(period, q.kind));
    return { id: period.startsWith("w:") ? "weekly" : q.kind, title: q.title, hint: q.hint, href: q.href, icon: q.icon, progress, target: q.target, done: progress >= q.target, claimed: claimed.has(`quest:${period}:${q.kind}`), rewardXp: xp, rewardCoins: coins };
  };
  const daily = dailyQuests(userId, pro).map((q) => view(q, dp, QUEST_REWARD.dailyXp, 0));
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return {
    daily,
    chest: { ready: daily.every((q) => q.claimed), claimed: claimed.has(`quest:${dp}:chest`), xp: QUEST_REWARD.chestXp, coins: QUEST_REWARD.chestCoins },
    weekly: view(WEEKLY, wp, QUEST_REWARD.weeklyXp, QUEST_REWARD.weeklyCoins),
    spin: { available: !spun, prizes: WHEEL.map((w) => w.label) },
    resetIn: Math.round((midnight.getTime() - Date.now()) / 1000),
  };
}

/** Inserts a once-only claim key; false if it already exists (a double click or a parallel request). */
async function claimOnce(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.dailyClaim.create({ data: { userId, key } });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

export type ClaimResult = { ok: true; xp: XpResult; coins: number } | { ok: false; reason: "not_ready" | "claimed" | "unknown" };

/** Pays a finished quest ("lesson", "chest", "weekly", ...) once. */
export async function claimQuest(userId: string, pro: boolean, id: string): Promise<ClaimResult> {
  const board = await getQuestBoard(userId, pro);
  let key: string;
  let xp: number;
  let coins: number;
  if (id === "chest") {
    if (!board.chest.ready) return { ok: false, reason: "not_ready" };
    [key, xp, coins] = [`quest:${dayPeriod()}:chest`, QUEST_REWARD.chestXp, QUEST_REWARD.chestCoins];
  } else if (id === "weekly") {
    if (!board.weekly.done) return { ok: false, reason: "not_ready" };
    [key, xp, coins] = [`quest:${weekPeriod()}:${WEEKLY.kind}`, QUEST_REWARD.weeklyXp, QUEST_REWARD.weeklyCoins];
  } else {
    const q = board.daily.find((d) => d.id === id);
    if (!q) return { ok: false, reason: "unknown" };
    if (!q.done) return { ok: false, reason: "not_ready" };
    [key, xp, coins] = [`quest:${dayPeriod()}:${id}`, QUEST_REWARD.dailyXp, 0];
  }
  if (!(await claimOnce(userId, key))) return { ok: false, reason: "claimed" };
  const paid = coins ? await addCoins(userId, coins, "quest") : 0;
  const res = await awardXp(userId, xp);
  return { ok: true, xp: res, coins: paid + res.coins };
}

export type SpinResult = { ok: true; index: number; label: string; coins: number; xp: XpResult | null } | { ok: false };

/** Once per UTC day; the claim key makes parallel spins lose. */
export async function spinWheel(userId: string): Promise<SpinResult> {
  if (!(await claimOnce(userId, `spin:${today()}`))) return { ok: false };
  const total = WHEEL.reduce((s, w) => s + w.weight, 0);
  let roll = randomInt(total);
  let index = 0;
  while (roll >= WHEEL[index].weight) roll -= WHEEL[index++].weight;
  const prize = WHEEL[index];
  const coins = prize.coins ? await addCoins(userId, prize.coins, "spin") : 0;
  const xp = prize.xp ? await awardXp(userId, prize.xp) : null;
  return { ok: true, index, label: prize.label, coins: coins + (xp?.coins ?? 0), xp };
}
