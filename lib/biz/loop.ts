import "server-only";
import { prisma } from "@/lib/db/prisma";
import { dayKey, eventFor, type OwnedItem } from "./engine";
import { kindOf } from "./catalog";
import { weekStart } from "./challenges";

/**
 * The daily loop on /biz: today's savings target, the savings streak, tomorrow's teaser, level progress and the team's
 * weekly goal. Everything is derived from real savings entries and business deposit events — nothing here adds capital.
 */
export interface LoopView {
  /** Goal the «Отложить» button deposits into (newest unfinished one), or null — then the client creates one. */
  goal: { id: string; title: string; saved: number; target: number } | null;
  savedToday: number;
  dailyTarget: number;
  /** Days in a row with a deposit, ending today (or yesterday, if today is still open). */
  streak: number;
  /** Last 7 days, oldest first: did the user deposit that day? */
  week: { day: string; saved: boolean }[];
  /** True until the first deposit after opening the business — the onboarding deposit step shows. */
  firstRun: boolean;
  tomorrow: string;
  level: { have: number; need: number; next: string | null };
  team: { target: number; total: number; members: { userId: string; name: string; amount: number; you: boolean }[] } | null;
}

const round50 = (n: number) => Math.max(100, Math.ceil(n / 50) * 50);

export async function loopView(
  userId: string,
  b: { id: string; kind: string; seed: number; dayNo: number; createdAt: Date },
  owned: OwnedItem[],
  level: number,
  members: { userId: string; name: string }[],
): Promise<LoopView> {
  const since = new Date(Date.now() - 60 * 86_400_000);
  const [goals, entries] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, saved: true, target: true, deadline: true } }),
    prisma.savingsEntry.findMany({ where: { goal: { userId }, amount: { gt: 0 }, createdAt: { gte: since } }, select: { amount: true, createdAt: true } }),
  ]);
  const goal = goals.find((g) => g.saved < g.target) ?? goals[0] ?? null;

  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(dayKey(e.createdAt), (byDay.get(dayKey(e.createdAt)) ?? 0) + e.amount);
  const day = (offset: number) => dayKey(new Date(Date.now() + offset * 86_400_000));
  const savedToday = byDay.get(day(0)) ?? 0;
  let streak = 0;
  for (let i = savedToday > 0 ? 0 : -1; byDay.has(day(i)); i--) streak++;
  const week = Array.from({ length: 7 }, (_, i) => ({ day: day(i - 6), saved: byDay.has(day(i - 6)) }));

  let dailyTarget = 200;
  if (goal) {
    const left = Math.max(0, goal.target - goal.saved);
    const days = goal.deadline ? Math.max(1, Math.ceil((goal.deadline.getTime() - Date.now()) / 86_400_000)) : 30;
    dailyTarget = Math.min(5000, round50(left / days));
  }

  const k = kindOf(b.kind);
  const working = new Set(owned.filter((o) => o.status === "ok").map((o) => o.itemId));
  const rule = k.levelRules[level - 1] ?? null;
  const levelInfo = rule ? { have: rule.filter((id) => working.has(id)).length, need: rule.length, next: k.levels[level] ?? null } : { have: 1, need: 1, next: null };

  const depositedSinceOpen = await prisma.bizEvent.count({ where: { businessId: b.id, kind: "deposit", userId, createdAt: { gte: b.createdAt } } });
  const firstRun = depositedSinceOpen === 0 && owned.length === 0;

  let team: LoopView["team"] = null;
  if (members.length > 1) {
    const { start } = weekStart();
    const sums = await prisma.bizEvent.groupBy({ by: ["userId"], where: { businessId: b.id, kind: "deposit", createdAt: { gte: start } }, _sum: { amount: true } });
    const amount = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));
    const list = members.map((m) => ({ userId: m.userId, name: m.name, amount: amount.get(m.userId) ?? 0, you: m.userId === userId }));
    team = { target: 1500 * members.length, total: list.reduce((a, m) => a + m.amount, 0), members: list.sort((a, c) => c.amount - a.amount) };
  }

  return {
    goal: goal ? { id: goal.id, title: goal.title, saved: goal.saved, target: goal.target } : null,
    savedToday,
    dailyTarget,
    streak,
    week,
    firstRun,
    tomorrow: eventFor(b.seed, b.dayNo + 1, owned, b.kind).teaser,
    level: levelInfo,
    team,
  };
}
