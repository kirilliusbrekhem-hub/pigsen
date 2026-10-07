import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import type { ConversationView, DmView, PublicUser } from "./meta";

const userSelect = { id: true, name: true, blocked: true, profile: { select: { title: true, avatar: true, proUntil: true } } } as const;
type RawUser = { id: string; name: string; blocked: boolean; profile: { title: string; avatar: string | null; proUntil: Date | null } | null };

function pub(u: RawUser, now: number): PublicUser {
  return { id: u.id, name: u.name, avatar: u.profile?.avatar ?? null, pro: !!u.profile?.proUntil && u.profile.proUntil.getTime() > now, title: u.profile?.title ?? "" };
}

export async function publicUser(id: string): Promise<PublicUser | null> {
  const u = await prisma.user.findUnique({ where: { id }, select: userSelect });
  return u && !u.blocked ? pub(u, Date.now()) : null;
}

export async function listConversations(userId: string): Promise<ConversationView[]> {
  const msgs = await prisma.directMessage.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { fromId: true, toId: true, text: true, createdAt: true },
  });
  const latest = new Map<string, (typeof msgs)[number]>();
  for (const m of msgs) {
    const other = m.fromId === userId ? m.toId : m.fromId;
    if (!latest.has(other)) latest.set(other, m);
  }
  if (!latest.size) return [];
  const [users, unread] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...latest.keys()] } }, select: userSelect }),
    prisma.directMessage.groupBy({ by: ["fromId"], where: { toId: userId, readAt: null }, _count: { _all: true } }),
  ]);
  const now = Date.now();
  const byId = new Map(users.map((u) => [u.id, u]));
  const unreadBy = new Map(unread.map((u) => [u.fromId, u._count._all]));
  return [...latest.entries()].flatMap(([other, m]) => {
    const u = byId.get(other);
    if (!u) return [];
    return [{ user: pub(u, now), last: { text: m.text.slice(0, 140), createdAt: m.createdAt.toISOString(), mine: m.fromId === userId }, unread: unreadBy.get(other) ?? 0 }];
  });
}

/** Last 100 messages of a thread (or newer than `after`), marks incoming as read. */
export async function listThread(userId: string, otherId: string, after?: Date): Promise<DmView[]> {
  const where = { OR: [{ fromId: userId, toId: otherId }, { fromId: otherId, toId: userId }], ...(after ? { createdAt: { gt: after } } : {}) };
  const rows = await prisma.directMessage.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, fromId: true, text: true, readAt: true, createdAt: true } });
  if (rows.some((r) => r.fromId === otherId && !r.readAt)) {
    await prisma.directMessage.updateMany({ where: { fromId: otherId, toId: userId, readAt: null }, data: { readAt: new Date() } });
  }
  return rows.reverse().map((r) => ({ id: r.id, text: r.text, createdAt: r.createdAt.toISOString(), mine: r.fromId === userId, read: r.fromId === userId ? !!r.readAt : true }));
}

export async function sendDm(sender: { id: string; profile: Parameters<typeof isPro>[0] }, toId: string, text: string): Promise<DmView> {
  if (toId === sender.id) throw new HttpError(422, "Нельзя написать самому себе");
  const to = await prisma.user.findUnique({ where: { id: toId }, select: { blocked: true } });
  if (!to || to.blocked) throw new HttpError(404, "Пользователь недоступен");
  if (!isPro(sender.profile)) {
    const received = await prisma.directMessage.findFirst({ where: { fromId: toId, toId: sender.id }, select: { id: true } });
    if (!received) throw new HttpError(403, "Начать переписку можно в Pro. Ответить на входящее сообщение можно бесплатно.");
  }
  const m = await prisma.directMessage.create({ data: { fromId: sender.id, toId, text }, select: { id: true, text: true, createdAt: true } });
  return { id: m.id, text: m.text, createdAt: m.createdAt.toISOString(), mine: true, read: false };
}

export const unreadCount = (userId: string) => prisma.directMessage.count({ where: { toId: userId, readAt: null } });
