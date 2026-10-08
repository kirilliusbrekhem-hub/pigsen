import "server-only";
import { prisma } from "@/lib/db/prisma";
import { invalidateCatalog } from "@/lib/content/catalog";
import { addCoins, extendPro, spendCoins } from "@/lib/coins/service";
import { HttpError } from "@/lib/api/http";
import { buildSearchText } from "@/lib/search/normalize";

const day = (n: number) => new Date(Date.now() - n * 86_400_000);

export async function adminStats() {
  const now = new Date();
  const [users, users7, active7, pro, blocked, convos, messages7, goals, saved, lessonsDone, payments, starsSum, rubSum, coins, content] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: day(7) } } }),
    prisma.profile.count({ where: { lastActiveAt: { gte: day(7) } } }),
    prisma.profile.count({ where: { proUntil: { gt: now } } }),
    prisma.user.count({ where: { blocked: true } }),
    prisma.conversation.count(),
    prisma.message.count({ where: { role: "user", createdAt: { gte: day(7) } } }),
    prisma.savingsGoal.aggregate({ _count: true, _sum: { saved: true } }),
    prisma.savedItem.count(),
    prisma.progress.count({ where: { status: "completed" } }),
    prisma.payment.count({ where: { status: "succeeded" } }),
    prisma.payment.aggregate({ where: { status: "succeeded", provider: "telegram" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "succeeded", provider: "yookassa" }, _sum: { amount: true } }),
    prisma.profile.aggregate({ _sum: { coins: true } }),
    prisma.contentItem.count({ where: { type: { not: "course" } } }),
  ]);
  // Sign-ups per day for the last 14 days.
  const recent = await prisma.user.findMany({ where: { createdAt: { gte: day(14) } }, select: { createdAt: true } });
  const signups = Array.from({ length: 14 }, (_, i) => {
    const d = day(13 - i).toISOString().slice(0, 10);
    return { day: d, count: recent.filter((u) => u.createdAt.toISOString().slice(0, 10) === d).length };
  });
  return {
    users, users7, active7, pro, blocked, convos, messages7,
    goals: goals._count, goalsSaved: goals._sum.saved ?? 0,
    saved, lessonsDone, payments,
    stars: starsSum._sum.amount ?? 0, rub: rubSum._sum.amount ?? 0,
    coins: coins._sum.coins ?? 0, content, signups,
  };
}

export async function listUsers(q: string, page: number) {
  const where = q
    ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * 30,
      take: 30,
      select: { id: true, email: true, name: true, createdAt: true, blocked: true, profile: { select: { xp: true, coins: true, proUntil: true, lastActiveAt: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total };
}

export async function userDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, createdAt: true, blocked: true,
      profile: { select: { xp: true, coins: true, proUntil: true, lastActiveAt: true, streak: true, bestStreak: true } },
      _count: { select: { conversations: true, savedItems: true, savingsGoals: true, ideaReviews: true } },
    },
  });
  if (!user) return null;
  const [lessons, payments, txs, goals] = await Promise.all([
    prisma.progress.count({ where: { userId: id, status: "completed" } }),
    prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.coinTx.findMany({ where: { userId: id, amount: { not: 0 } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.savingsGoal.findMany({ where: { userId: id }, select: { title: true, saved: true, target: true } }),
  ]);
  return { user, lessons, payments, txs, goals };
}

export type AdminAction =
  | { kind: "pro"; days: number }
  | { kind: "revokePro" }
  | { kind: "coins"; amount: number }
  | { kind: "block"; blocked: boolean };

export async function applyUserAction(adminId: string, userId: string, a: AdminAction) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new HttpError(404, "Пользователь не найден");
  switch (a.kind) {
    case "pro":
      await extendPro(userId, a.days);
      break;
    case "revokePro":
      await prisma.profile.update({ where: { userId }, data: { proUntil: null, plan: "free" } });
      break;
    case "coins":
      if (a.amount > 0) await addCoins(userId, a.amount, "admin");
      else if (!(await spendCoins(userId, -a.amount, "admin"))) throw new HttpError(422, "У пользователя меньше монет, чем вы списываете");
      break;
    case "block":
      if (userId === adminId) throw new HttpError(422, "Нельзя заблокировать самого себя");
      await prisma.user.update({ where: { id: userId }, data: { blocked: a.blocked } });
      break;
  }
}

export async function listPayments() {
  return prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { email: true, name: true } } } });
}

// ---------- Library content ----------

export interface ContentInput {
  title: string;
  description: string;
  body: string;
  type: "article" | "book" | "video" | "podcast";
  category: string;
  author: string;
  source: string;
  url: string | null;
  readingTime: number;
  tags: string[];
  featured: boolean;
  premium: boolean;
  trending: number;
}

function slugify(title: string): string {
  const map: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  const base = title.toLowerCase().split("").map((ch) => map[ch] ?? ch).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return base || "material";
}

async function dataFor(input: ContentInput) {
  const category = await prisma.category.findUnique({ where: { slug: input.category } });
  if (!category) throw new HttpError(422, "Нет такой категории");
  return {
    title: input.title,
    description: input.description,
    body: input.body,
    type: input.type,
    author: input.author,
    source: input.source,
    url: input.url,
    readingTime: input.readingTime,
    tags: input.tags.map((t) => t.toLowerCase()).join(","),
    featured: input.featured,
    premium: input.premium,
    trending: input.trending,
    categoryId: category.id,
    searchText: buildSearchText(input.title, input.description, input.author, input.tags.join(" "), input.body),
    adminEdited: true,
  };
}

export async function createContent(input: ContentInput) {
  const base = slugify(input.title);
  let slug = base;
  for (let i = 2; await prisma.contentItem.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const created = await prisma.contentItem.create({ data: { slug, publishedAt: new Date(), ...(await dataFor(input)) } });
  invalidateCatalog();
  return created;
}

export async function updateContent(id: string, input: ContentInput) {
  const item = await prisma.contentItem.findUnique({ where: { id }, select: { type: true } });
  if (!item || item.type === "course") throw new HttpError(404, "Материал не найден");
  const updated = await prisma.contentItem.update({ where: { id }, data: await dataFor(input) });
  invalidateCatalog();
  return updated;
}

export async function deleteContent(id: string) {
  const item = await prisma.contentItem.findUnique({ where: { id }, select: { slug: true, type: true } });
  if (!item || item.type === "course") throw new HttpError(404, "Материал не найден");
  await prisma.$transaction([
    prisma.savedItem.deleteMany({ where: { contentItemId: id } }),
    prisma.contentView.deleteMany({ where: { contentItemId: id } }),
    prisma.contentItem.delete({ where: { id } }),
    prisma.deletedSlug.upsert({ where: { slug: item.slug }, update: {}, create: { slug: item.slug } }),
  ]);
  invalidateCatalog();
}

// ---------- Growth charts (last 30 days, UTC days) ----------

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function growthStats() {
  const DAYS = 30;
  const since = new Date(day(DAYS - 1).toISOString().slice(0, 10) + "T00:00:00Z");
  const keys = Array.from({ length: DAYS }, (_, i) => dayKey(new Date(since.getTime() + i * 86_400_000)));
  // Prisma stores UTC in timestamp(3) without tz, so to_char gives the UTC day. Distinct (user, day) activity from real events: lessons, views, $PIG questions, coin ledger.
  const activity = await prisma.$queryRaw<{ userId: string; d: string }[]>`
    SELECT DISTINCT "userId", to_char(t, 'YYYY-MM-DD') AS d FROM (
      SELECT "userId", "updatedAt" AS t FROM "Progress" WHERE "updatedAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "ContentView" WHERE "createdAt" >= ${since}
      UNION ALL SELECT c."userId", m."createdAt" FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId" WHERE m.role = 'user' AND m."createdAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "CoinTx" WHERE "createdAt" >= ${since}
    ) a`;
  const [users, payments, coinRows, refTotal, refActive, reviews] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    prisma.payment.findMany({ where: { createdAt: { gte: since }, OR: [{ status: "succeeded" }, { applied: true }] }, select: { createdAt: true } }),
    prisma.coinTx.findMany({ where: { createdAt: { gte: since }, amount: { gt: 0 }, reason: { not: "admin" } }, select: { createdAt: true, amount: true } }),
    prisma.referral.count(),
    prisma.referral.count({ where: { rewarded: true } }),
    prisma.review.groupBy({ by: ["status"], _count: true }),
  ]);
  const series = (fill: (m: Map<string, number>) => void) => {
    const m = new Map(keys.map((k) => [k, 0]));
    fill(m);
    return keys.map((k) => ({ day: k, value: m.get(k) ?? 0 }));
  };
  const bump = (m: Map<string, number>, k: string, n = 1) => m.has(k) && m.set(k, (m.get(k) ?? 0) + n);

  const activeByUser = new Map<string, Set<string>>();
  for (const a of activity) {
    if (!activeByUser.has(a.userId)) activeByUser.set(a.userId, new Set());
    activeByUser.get(a.userId)!.add(a.d);
  }
  // Retention for the cohort registered 8–30 days ago (all have a full week behind them).
  const cohort = users.filter((u) => u.createdAt < day(8));
  let d1 = 0, d7 = 0;
  for (const u of cohort) {
    const days = activeByUser.get(u.id);
    if (!days) continue;
    const base = new Date(dayKey(u.createdAt) + "T00:00:00Z").getTime();
    const off = (n: number) => dayKey(new Date(base + n * 86_400_000));
    if (days.has(off(1))) d1++;
    if ([1, 2, 3, 4, 5, 6, 7].some((n) => days.has(off(n)))) d7++;
  }
  const pct = (n: number) => (cohort.length ? Math.round((n / cohort.length) * 100) : 0);
  const reviewCount = (s: string) => reviews.find((r) => r.status === s)?._count ?? 0;

  return {
    signups: series((m) => users.forEach((u) => bump(m, dayKey(u.createdAt)))),
    active: series((m) => activity.forEach((a) => bump(m, a.d))),
    purchases: series((m) => payments.forEach((p) => bump(m, dayKey(p.createdAt)))),
    coinsEarned: series((m) => coinRows.forEach((c) => bump(m, dayKey(c.createdAt), c.amount))),
    retention: { cohort: cohort.length, d1: pct(d1), d7: pct(d7) },
    referrals: { total: refTotal, activated: refActive },
    reviews: { pending: reviewCount("pending"), approved: reviewCount("approved"), rejected: reviewCount("rejected") },
  };
}

// ---------- Funnel & marketing (period = last N days, UTC) ----------

/** Distinct (user, UTC day) activity — same sources as growthStats. */
async function activityDays(userIds: string[], since: Date) {
  if (!userIds.length) return new Map<string, Set<string>>();
  const rows = await prisma.$queryRaw<{ userId: string; d: string }[]>`
    SELECT DISTINCT "userId", to_char(t, 'YYYY-MM-DD') AS d FROM (
      SELECT "userId", "updatedAt" AS t FROM "Progress" WHERE "updatedAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "ContentView" WHERE "createdAt" >= ${since}
      UNION ALL SELECT c."userId", m."createdAt" FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId" WHERE m.role = 'user' AND m."createdAt" >= ${since}
      UNION ALL SELECT "userId", "createdAt" FROM "CoinTx" WHERE "createdAt" >= ${since}
    ) a WHERE "userId" = ANY(${userIds})`;
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, new Set());
    map.get(r.userId)!.add(r.d);
  }
  return map;
}

interface CohortUser { id: string; createdAt: Date; activated: boolean; returned: boolean; pro: boolean; trial: boolean }

async function cohort(days: number): Promise<{ since: Date; users: CohortUser[] }> {
  const since = new Date(day(days - 1).toISOString().slice(0, 10) + "T00:00:00Z");
  const users = await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } });
  const ids = users.map((u) => u.id);
  const [active, done, paid, trials] = await Promise.all([
    activityDays(ids, since),
    prisma.progress.findMany({ where: { userId: { in: ids }, status: "completed" }, select: { userId: true }, distinct: ["userId"] }),
    prisma.payment.findMany({ where: { userId: { in: ids }, OR: [{ status: "succeeded" }, { applied: true }] }, select: { userId: true }, distinct: ["userId"] }),
    prisma.coinTx.findMany({ where: { userId: { in: ids }, reason: "shop:pro-trial" }, select: { userId: true }, distinct: ["userId"] }),
  ]);
  const doneS = new Set(done.map((r) => r.userId));
  const paidS = new Set(paid.map((r) => r.userId));
  const trialS = new Set(trials.map((r) => r.userId));
  return {
    since,
    users: users.map((u) => {
      const reg = dayKey(u.createdAt);
      const returned = [...(active.get(u.id) ?? [])].some((d) => d > reg);
      return { id: u.id, createdAt: u.createdAt, activated: doneS.has(u.id), returned, pro: paidS.has(u.id), trial: trialS.has(u.id) };
    }),
  };
}

export async function funnelStats(days: 7 | 30) {
  const { since, users } = await cohort(days);
  const visitors = await prisma.visit.groupBy({ by: ["visitorId"], where: { day: { gte: dayKey(since) } } });
  const count = (f: (u: CohortUser) => boolean) => users.filter(f).length;
  return {
    days,
    steps: [
      { key: "visits", label: "Визиты (уникальные)", value: visitors.length },
      { key: "register", label: "Регистрации", value: users.length },
      { key: "activated", label: "Активированы (≥1 урок)", value: count((u) => u.activated) },
      { key: "returned", label: "Вернулись в другой день", value: count((u) => u.returned) },
      { key: "pro", label: "Купили Pro", value: count((u) => u.pro) },
    ],
    trial: count((u) => u.trial),
  };
}

export async function marketingStats(days: 7 | 30) {
  const { users } = await cohort(days);
  const attrs = await prisma.attribution.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, source: true, campaign: true } });
  const byUser = new Map(attrs.map((a) => [a.userId, a]));
  const rows = new Map<string, { source: string; campaign: string; registrations: number; activated: number; returned: number; pro: number; trial: number }>();
  for (const u of users) {
    const a = byUser.get(u.id);
    const source = a?.source || "(нет данных)";
    const campaign = a?.campaign || "—";
    const k = `${source}\u0000${campaign}`;
    const r = rows.get(k) ?? { source, campaign, registrations: 0, activated: 0, returned: 0, pro: 0, trial: 0 };
    r.registrations++;
    if (u.activated) r.activated++;
    if (u.returned) r.returned++;
    if (u.pro) r.pro++;
    if (u.trial) r.trial++;
    rows.set(k, r);
  }
  return [...rows.values()].sort((a, b) => b.registrations - a.registrations);
}
