import "server-only";
import { prisma } from "@/lib/db/prisma";
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
  return prisma.contentItem.create({ data: { slug, publishedAt: new Date(), ...(await dataFor(input)) } });
}

export async function updateContent(id: string, input: ContentInput) {
  const item = await prisma.contentItem.findUnique({ where: { id }, select: { type: true } });
  if (!item || item.type === "course") throw new HttpError(404, "Материал не найден");
  return prisma.contentItem.update({ where: { id }, data: await dataFor(input) });
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
}
