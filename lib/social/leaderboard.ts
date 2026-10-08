import "server-only";
import { prisma } from "@/lib/db/prisma";
import { LOOK_SELECT, lookOf, type Look } from "@/lib/profile/cosmetics";
import { avatarUrl } from "@/lib/profile/avatar-url";
import { XP } from "@/lib/gamification/service";
import { addCoins, extendPro } from "@/lib/coins/service";
import { currentWeek, lastWeek, type Week } from "./week";

/**
 * Weekly points = XP actually earned for learning in that ISO week, recomputed from source rows:
 * lessons first completed in the week (Progress.completedAt is set once and never moves, so it can't be farmed)
 * x XP.lessonCompleted, plus QuizAttempt.xpAwarded for quizzes finished in the week.
 * CoinTx "xp" rows are not used: they mix in the Pro x2 coin multiplier, so they don't measure XP.
 * Only Pro users are ranked (prizes are for subscribers).
 */
export const PRIZES: { place: number; label: string; proDays: number; coins: number; title?: string }[] = [
  { place: 1, label: "1 место", proDays: 30, coins: 2000, title: "Чемпион недели" },
  { place: 2, label: "2 место", proDays: 14, coins: 1000 },
  { place: 3, label: "3 место", proDays: 7, coins: 500 },
  ...[4, 5, 6, 7, 8, 9, 10].map((place) => ({ place, label: `${place} место`, proDays: 0, coins: 200 })),
];
export const prizeFor = (place: number) => PRIZES.find((p) => p.place === place);

export interface Row {
  place: number;
  userId: string;
  name: string;
  title: string;
  avatarUrl: string | null;
  points: number;
  /** Cosmetics others see: name color, avatar frame, emblem. */
  look: Look;
}

export async function weeklyRanking(week: Week): Promise<Row[]> {
  const [lessons, quizzes] = await Promise.all([
    prisma.progress.groupBy({ by: ["userId"], where: { completedAt: { gte: week.start, lt: week.end } }, _count: { _all: true } }),
    prisma.quizAttempt.groupBy({ by: ["userId"], where: { completedAt: { gte: week.start, lt: week.end }, xpAwarded: { gt: 0 } }, _sum: { xpAwarded: true } }),
  ]);
  const points = new Map<string, number>();
  for (const l of lessons) points.set(l.userId, (points.get(l.userId) ?? 0) + l._count._all * XP.lessonCompleted);
  for (const q of quizzes) points.set(q.userId, (points.get(q.userId) ?? 0) + (q._sum.xpAwarded ?? 0));
  if (!points.size) return [];
  // Pro during the week: for the running week "Pro now", for a finished week "Pro at some point after it began".
  const now = new Date();
  const proSince = week.end > now ? now : week.start;
  const users = await prisma.user.findMany({
    where: { id: { in: [...points.keys()] }, blocked: false, profile: { proUntil: { gt: proSince } } },
    select: { id: true, name: true, profile: { select: { title: true, avatar: true, updatedAt: true, proUntil: true, ...LOOK_SELECT } } },
  });
  return users
    .map((u) => ({ userId: u.id, name: u.name, title: u.profile?.title ?? "", avatarUrl: avatarUrl(u.id, u.profile), points: points.get(u.id) ?? 0, look: lookOf(u.profile) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
    .map((r, i) => ({ ...r, place: i + 1 }));
}

export async function currentBoard(userId: string) {
  const week = currentWeek();
  const rows = await weeklyRanking(week);
  return { week, top: rows.slice(0, 20), me: rows.find((r) => r.userId === userId) ?? null, total: rows.length };
}

/** Awards a finished week's winners. Idempotent per winner via DailyClaim key `lb:<yyyy-Www>`. */
export async function awardWeek(week: Week) {
  if (week.end > new Date()) throw new Error("Week is not finished yet");
  const rows = (await weeklyRanking(week)).slice(0, PRIZES.length);
  const key = `lb:${week.key}`;
  const awarded: { userId: string; place: number }[] = [];
  for (const r of rows) {
    const prize = prizeFor(r.place);
    if (!prize) continue;
    try {
      await prisma.dailyClaim.create({ data: { userId: r.userId, key } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue; // already awarded
      throw e;
    }
    await addCoins(r.userId, prize.coins, `leaderboard:${week.key}:${r.place}`);
    if (prize.proDays) await extendPro(r.userId, prize.proDays);
    if (prize.title) await prisma.profile.update({ where: { userId: r.userId }, data: { title: prize.title } });
    awarded.push({ userId: r.userId, place: r.place });
  }
  return { week: week.key, awarded, alreadyDone: rows.length - awarded.length };
}

export const awardLastWeek = () => awardWeek(lastWeek());
