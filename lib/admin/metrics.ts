import "server-only";
import { prisma } from "@/lib/db/prisma";

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (ms: number) => new Date(dayKey(new Date(ms)) + "T00:00:00Z");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/** Distinct (user, UTC day) activity since `since`: lessons, views, $PIG, coins, savings entries, tracked events. */
async function activity(since: Date) {
  return prisma.$queryRaw<{ userId: string; d: string }[]>`
    SELECT DISTINCT "userId", to_char(t, 'YYYY-MM-DD') AS d FROM (
      SELECT "userId", "updatedAt" AS t FROM "Progress" WHERE "updatedAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "ContentView" WHERE "createdAt" >= ${since}
      UNION ALL SELECT c."userId", m."createdAt" FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId" WHERE m.role = 'user' AND m."createdAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "CoinTx" WHERE "createdAt" >= ${since}
      UNION ALL SELECT g."userId", e."createdAt" FROM "SavingsEntry" e JOIN "SavingsGoal" g ON g.id = e."goalId" WHERE e."createdAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "AnalyticsEvent" WHERE "userId" IS NOT NULL AND "createdAt" >= ${since}
    ) a WHERE "userId" IS NOT NULL`;
}

export async function investorMetrics() {
  const now = Date.now();
  const today = startOfDay(now);
  const since30 = new Date(today.getTime() - 29 * DAY);
  const since120 = new Date(today.getTime() - 119 * DAY);

  const [act, users, totalUsers, depositors, bizMembers, payers, revenue, revenue30, confirmed, refTotal, ref30, users30Base, errors] = await Promise.all([
    activity(since120),
    prisma.user.findMany({ where: { createdAt: { gte: since120 } }, select: { id: true, createdAt: true } }),
    prisma.user.count(),
    prisma.$queryRaw<{ userId: string }[]>`SELECT DISTINCT g."userId" FROM "SavingsEntry" e JOIN "SavingsGoal" g ON g.id = e."goalId" WHERE e.amount > 0`,
    prisma.bizMember.findMany({ select: { userId: true, role: true, businessId: true } }),
    prisma.payment.findMany({ where: { OR: [{ status: "succeeded" }, { applied: true }], plan: { not: { startsWith: "coins-" } } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.payment.groupBy({ by: ["provider", "plan"], where: { OR: [{ status: "succeeded" }, { applied: true }] }, _sum: { amount: true }, _count: true }),
    prisma.payment.groupBy({ by: ["provider", "plan"], where: { createdAt: { gte: since30 }, OR: [{ status: "succeeded" }, { applied: true }] }, _sum: { amount: true } }),
    prisma.depositProof.aggregate({ where: { status: "confirmed" }, _sum: { amount: true }, _count: true }),
    prisma.referral.count(),
    prisma.referral.count({ where: { createdAt: { gte: since30 } } }),
    prisma.user.count({ where: { createdAt: { lt: since30 } } }),
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const confirmedUsers = await prisma.depositProof.groupBy({ by: ["userId"], where: { status: "confirmed" } });

  // Active users
  const byDay = new Map<string, Set<string>>();
  const byUser = new Map<string, Set<string>>();
  for (const a of act) {
    (byDay.get(a.d) ?? byDay.set(a.d, new Set()).get(a.d)!).add(a.userId);
    (byUser.get(a.userId) ?? byUser.set(a.userId, new Set()).get(a.userId)!).add(a.d);
  }
  const windowUsers = (n: number) => {
    const s = new Set<string>();
    for (let i = 0; i < n; i++) byDay.get(dayKey(new Date(today.getTime() - i * DAY)))?.forEach((u) => s.add(u));
    return s.size;
  };
  const dau = windowUsers(1), wau = windowUsers(7), mau = windowUsers(30);
  const keys = Array.from({ length: 30 }, (_, i) => dayKey(new Date(since30.getTime() + i * DAY)));
  const signupsMap = new Map(keys.map((k) => [k, 0]));
  for (const u of users) { const k = dayKey(u.createdAt); if (signupsMap.has(k)) signupsMap.set(k, signupsMap.get(k)! + 1); }
  const signups = keys.map((day) => ({ day, value: signupsMap.get(day)! }));
  const dauSeries = keys.map((day) => ({ day, value: byDay.get(day)?.size ?? 0 }));

  // Return on day >= n after signup (unbounded retention), counted only for users old enough.
  // Fixed windows: D1 = day 1, D7 = days 7–13, D30 = days 30–36 after the signup day.
  const WINDOWS: Record<number, [number, number]> = { 1: [1, 1], 7: [7, 13], 30: [30, 36] };
  const returnedAfter = (u: { id: string; createdAt: Date }, n: number) => {
    const [a, b] = WINDOWS[n] ?? [n, n];
    const base = startOfDay(u.createdAt.getTime()).getTime();
    const lo = dayKey(new Date(base + a * DAY)), hi = dayKey(new Date(base + b * DAY));
    for (const d of byUser.get(u.id) ?? []) if (d >= lo && d <= hi) return true;
    return false;
  };
  const oldEnough = (u: { createdAt: Date }, n: number) => ageDays(u) >= (WINDOWS[n]?.[1] ?? n);
  const ageDays = (u: { createdAt: Date }) => Math.floor((today.getTime() - startOfDay(u.createdAt.getTime()).getTime()) / DAY);

  // Funnel: users who signed up in the last 90 days.
  const depSet = new Set(depositors.map((d) => d.userId));
  const bizSet = new Set(bizMembers.map((m) => m.userId));
  const fUsers = users.filter((u) => ageDays(u) < 90);
  const fDep = fUsers.filter((u) => depSet.has(u.id));
  const fBiz = fDep.filter((u) => bizSet.has(u.id));
  const fRet = fBiz.filter((u) => returnedAfter(u, 7));
  const funnel = [
    { key: "signup", label: "Регистрация", value: fUsers.length },
    { key: "deposit", label: "Первый взнос в копилку", value: fDep.length },
    { key: "biz", label: "Бизнес создан или найден", value: fBiz.length },
    { key: "d7", label: "Активны в дни 7–13", value: fRet.length },
  ];

  // Weekly cohorts (last 8 weeks)
  const cohorts = Array.from({ length: 8 }, (_, w) => {
    const end = today.getTime() - w * 7 * DAY + DAY;
    const start = end - 7 * DAY;
    const members = users.filter((u) => u.createdAt.getTime() >= start && u.createdAt.getTime() < end);
    const cell = (n: number) => {
      const eligible = members.filter((u) => oldEnough(u, n));
      return eligible.length ? pct(eligible.filter((u) => returnedAfter(u, n)).length, eligible.length) : null;
    };
    return { label: dayKey(new Date(start)).slice(5), size: members.length, d1: cell(1), d7: cell(7), d30: cell(30) };
  }).reverse();
  const overall = (n: number) => {
    const el = users.filter((u) => oldEnough(u, n));
    return { value: pct(el.filter((u) => returnedAfter(u, n)).length, el.length), base: el.length };
  };

  // Revenue
  type Row = { provider: string; plan: string; _sum: { amount: number | null } };
  const split = (rows: Row[]) => {
    const sum = (prov: string, coins: boolean) => rows.filter((r) => r.provider === prov && r.plan.startsWith("coins-") === coins).reduce((s, r) => s + (r._sum.amount ?? 0), 0);
    return { proRub: sum("yookassa", false), proStars: sum("telegram", false), coinsRub: sum("yookassa", true), coinsStars: sum("telegram", true) };
  };
  const rev = split(revenue), rev30 = split(revenue30);
  const paidCount = revenue.reduce((s, r) => s + r._count, 0);

  // Team share: members of businesses with 2+ people among all business members.
  const sizes = new Map<string, number>();
  for (const m of bizMembers) sizes.set(m.businessId, (sizes.get(m.businessId) ?? 0) + 1);
  const inTeam = bizMembers.filter((m) => (sizes.get(m.businessId) ?? 0) >= 2).length;

  const confirmedTotal = confirmed._sum.amount ?? 0;
  return {
    totalUsers,
    dau, wau, mau,
    stickiness: pct(dau, mau),
    signups, dauSeries,
    funnel,
    retention: { d1: overall(1), d7: overall(7), d30: overall(30) },
    cohorts,
    pro: { payers: payers.length, conversion: pct(payers.length, totalUsers), payments: paidCount, rev, rev30 },
    savings: { confirmedTotal, confirmedCount: confirmed._count, savers: confirmedUsers.length, avgPerSaver: confirmedUsers.length ? Math.round(confirmedTotal / confirmedUsers.length) : 0 },
    team: { members: bizMembers.length, businesses: sizes.size, inTeam, share: pct(inTeam, bizMembers.length), adoption: pct(bizMembers.length, totalUsers) },
    viral: { invites: refTotal, invites30: ref30, k: totalUsers ? Math.round((refTotal / totalUsers) * 100) / 100 : 0, k30: users30Base ? Math.round((ref30 / users30Base) * 100) / 100 : 0 },
    errors,
  };
}
