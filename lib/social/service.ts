import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { addCoins } from "@/lib/coins/service";
import { isAdminEmail } from "@/lib/admin/auth";
import { CHALLENGES, challengeById } from "./challenges";

/** Free users may do challenges marked `free`; Pro unlocks all. */
export const canDoChallenge = (id: string, pro: boolean) => pro || !!challengeById(id)?.free;

export async function doneChallenges(userId: string) {
  const rows = await prisma.challengeDone.findMany({ where: { userId }, select: { challengeId: true, note: true, createdAt: true } });
  return new Map(rows.map((r) => [r.challengeId, r]));
}

export async function completeChallenge(userId: string, id: string, note: string, pro: boolean) {
  const c = challengeById(id);
  if (!c) throw new HttpError(404, "Челлендж не найден");
  if (!canDoChallenge(id, pro)) throw new HttpError(403, "Этот челлендж доступен в Pro");
  try {
    await prisma.challengeDone.create({ data: { userId, challengeId: id, note } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "Челлендж уже выполнен");
    throw e;
  }
  const coins = await addCoins(userId, c.reward, `challenge:${id}`);
  return { coins };
}

export const challengeCount = () => CHALLENGES.length;

// ---- Community ----
export const POST_MAX = 1000;
export const PAGE_SIZE = 30;

const authorSelect = { id: true, name: true, profile: { select: { title: true, avatar: true, proUntil: true } } } as const;

export interface PostView {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string; title: string; avatar: string | null; pro: boolean };
  canDelete: boolean;
  replies: PostView[];
}

type RawPost = {
  id: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string; profile: { title: string; avatar: string | null; proUntil: Date | null } | null };
};

function view(p: RawPost, viewer: { id: string; email: string }, now: number, replies: RawPost[] = []): PostView {
  return {
    id: p.id,
    text: p.text,
    createdAt: p.createdAt.toISOString(),
    author: { id: p.user.id, name: p.user.name, title: p.user.profile?.title ?? "", avatar: p.user.profile?.avatar ?? null, pro: !!p.user.profile?.proUntil && p.user.profile.proUntil.getTime() > now },
    canDelete: p.user.id === viewer.id || isAdminEmail(viewer.email),
    replies: replies.map((r) => view(r, viewer, now)),
  };
}

/** Newest top-level posts first, replies oldest first. `before` is a post id cursor. */
export async function listPosts(viewer: { id: string; email: string }, opts: { before?: string; take?: number } = {}) {
  const take = opts.take ?? PAGE_SIZE;
  const rows = await prisma.communityPost.findMany({
    where: { parentId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.before ? { cursor: { id: opts.before }, skip: 1 } : {}),
    select: { id: true, text: true, createdAt: true, user: { select: authorSelect }, replies: { orderBy: { createdAt: "asc" }, take: 50, select: { id: true, text: true, createdAt: true, user: { select: authorSelect } } } },
  });
  const now = Date.now();
  const page = rows.slice(0, take);
  return { posts: page.map((p) => view(p, viewer, now, p.replies)), next: rows.length > take ? page[page.length - 1]?.id ?? null : null };
}

export async function createPost(viewer: { id: string; email: string }, text: string, parentId?: string) {
  if (parentId) {
    const parent = await prisma.communityPost.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) throw new HttpError(404, "Пост не найден");
    if (parent.parentId) throw new HttpError(422, "Можно отвечать только на пост");
  }
  const p = await prisma.communityPost.create({ data: { userId: viewer.id, text, parentId: parentId ?? null }, select: { id: true, text: true, createdAt: true, user: { select: authorSelect } } });
  return view(p, viewer, Date.now());
}

export async function deletePost(viewer: { id: string; email: string }, id: string) {
  const p = await prisma.communityPost.findUnique({ where: { id }, select: { userId: true } });
  if (!p) throw new HttpError(404, "Пост не найден");
  if (p.userId !== viewer.id && !isAdminEmail(viewer.email)) throw new HttpError(403, "Можно удалять только свои посты");
  await prisma.communityPost.delete({ where: { id } });
}
