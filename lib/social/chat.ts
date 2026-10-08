import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { isAdmin } from "@/lib/admin/auth";
import { avatarUrl } from "@/lib/profile/avatar-url";
import { LOOK_SELECT, lookOf, type LookFields } from "@/lib/profile/cosmetics";

import type { ChatMsgView, RoomId } from "./meta";

const userSelect = { id: true, name: true, profile: { select: { title: true, avatar: true, proUntil: true, updatedAt: true, ...LOOK_SELECT } } } as const;
type Raw = { id: string; text: string; createdAt: Date; user: { id: string; name: string; profile: ({ title: string; avatar: string | null; proUntil: Date | null; updatedAt: Date } & LookFields) | null } };

function view(m: Raw, viewerId: string, now: number): ChatMsgView {
  const p = m.user.profile;
  return {
    id: m.id,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    mine: m.user.id === viewerId,
    author: { id: m.user.id, name: m.user.name, avatarUrl: avatarUrl(m.user.id, p), pro: !!p?.proUntil && p.proUntil.getTime() > now, title: p?.title ?? "", look: lookOf(p) },
  };
}

/** Last 50 messages (oldest first) or everything newer than `after`. */
export async function listChat(viewerId: string, room: RoomId, after?: Date) {
  const now = Date.now();
  if (after) {
    const rows = await prisma.chatMessage.findMany({ where: { room, createdAt: { gt: after } }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true, text: true, createdAt: true, user: { select: userSelect } } });
    return rows.map((m) => view(m, viewerId, now));
  }
  const rows = await prisma.chatMessage.findMany({ where: { room }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, text: true, createdAt: true, user: { select: userSelect } } });
  return rows.reverse().map((m) => view(m, viewerId, now));
}

export async function sendChat(viewerId: string, room: RoomId, text: string) {
  const m = await prisma.chatMessage.create({ data: { room, userId: viewerId, text }, select: { id: true, text: true, createdAt: true, user: { select: userSelect } } });
  return view(m, viewerId, Date.now());
}

export async function deleteChat(viewer: { id: string; email: string }, id: string) {
  const m = await prisma.chatMessage.findUnique({ where: { id }, select: { userId: true } });
  if (!m) throw new HttpError(404, "Сообщение не найдено");
  if (!(await isAdmin(viewer)) && m.userId !== viewer.id) throw new HttpError(403, "Нет прав");
  await prisma.chatMessage.delete({ where: { id } });
}
