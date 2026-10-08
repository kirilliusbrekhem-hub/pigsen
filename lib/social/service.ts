import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { addCoins } from "@/lib/coins/service";
import { isAdmin } from "@/lib/admin/auth";
import type { Look } from "@/lib/profile/cosmetics";
import { avatarUrl } from "@/lib/profile/avatar-url";
import { LOOK_SELECT, lookOf, type LookFields } from "@/lib/profile/cosmetics";

import { CHALLENGES, challengeById } from "./challenges";
import { LIKE_REWARD, LIKE_REWARD_AT, POST_KINDS, POST_TOPICS, type PostKind, type PostTopic } from "./meta";

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

const authorSelect = { id: true, name: true, profile: { select: { title: true, avatar: true, proUntil: true, updatedAt: true, ...LOOK_SELECT } } } as const;

export interface PostView {
  id: string;
  text: string;
  createdAt: string;
  kind: PostKind;
  topic: PostTopic | "";
  author: { id: string; name: string; title: string; avatarUrl: string | null; pro: boolean; look: Look };
  canDelete: boolean;
  likes: number;
  liked: boolean;
  replyCount: number;
  replies: PostView[];
}

type Viewer = { id: string; email: string; admin?: boolean };

const postSelect = (viewerId: string) =>
  ({
    id: true,
    text: true,
    createdAt: true,
    kind: true,
    topic: true,
    user: { select: authorSelect },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { likes: true, replies: true } },
  }) as const;

type RawPost = {
  id: string;
  text: string;
  createdAt: Date;
  kind: string;
  topic: string;
  user: { id: string; name: string; profile: ({ title: string; avatar: string | null; proUntil: Date | null; updatedAt: Date } & LookFields) | null };
  likes: { userId: string }[];
  _count: { likes: number; replies: number };
};

function view(p: RawPost, viewer: Viewer, now: number, replies: RawPost[] = []): PostView {
  return {
    id: p.id,
    text: p.text,
    createdAt: p.createdAt.toISOString(),
    kind: (p.kind in POST_KINDS ? p.kind : "post") as PostKind,
    topic: (p.topic in POST_TOPICS ? p.topic : "") as PostTopic | "",
    author: { id: p.user.id, name: p.user.name, title: p.user.profile?.title ?? "", avatarUrl: avatarUrl(p.user.id, p.user.profile), pro: !!p.user.profile?.proUntil && p.user.profile.proUntil.getTime() > now, look: lookOf(p.user.profile) },
    canDelete: p.user.id === viewer.id || !!viewer.admin,
    likes: p._count.likes,
    liked: p.likes.length > 0,
    replyCount: p._count.replies,
    replies: replies.map((r) => view(r, viewer, now)),
  };
}

export interface ListOpts { before?: string; take?: number; kind?: PostKind; topic?: PostTopic; sort?: "new" | "top" }

/** Top-level posts (newest first, or most liked this week), replies oldest first. `before` is a post id cursor (only for "new"). */
export async function listPosts(viewer: Viewer, opts: ListOpts = {}) {
  const take = opts.take ?? PAGE_SIZE;
  const now = Date.now();
  const top = opts.sort === "top";
  const where = {
    parentId: null,
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.topic ? { topic: opts.topic } : {}),
    ...(top ? { createdAt: { gte: new Date(now - 7 * 86_400_000) } } : {}),
  };
  const sel = postSelect(viewer.id);
  const [admin, rows] = await Promise.all([
    isAdmin(viewer),
    prisma.communityPost.findMany({
      where,
      orderBy: top ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }] : [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(opts.before && !top ? { cursor: { id: opts.before }, skip: 1 } : {}),
      select: { ...sel, replies: { orderBy: { createdAt: "asc" }, take: 50, select: sel } },
    }),
  ]);
  viewer = { ...viewer, admin };
  const page = rows.slice(0, take);
  return { posts: page.map((p) => view(p, viewer, now, p.replies)), next: !top && rows.length > take ? page[page.length - 1]?.id ?? null : null };
}

export async function createPost(viewer: Viewer, text: string, opts: { parentId?: string; kind?: PostKind; topic?: PostTopic } = {}) {
  const { parentId } = opts;
  if (parentId) {
    const parent = await prisma.communityPost.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) throw new HttpError(404, "Пост не найден");
    if (parent.parentId) throw new HttpError(422, "Можно отвечать только на пост");
  }
  const p = await prisma.communityPost.create({
    data: { userId: viewer.id, text, parentId: parentId ?? null, kind: parentId ? "post" : opts.kind ?? "post", topic: parentId ? "" : opts.topic ?? "other" },
    select: postSelect(viewer.id),
  });
  return view(p, viewer, Date.now());
}

/** Toggles a like. Pays the author once when a post reaches LIKE_REWARD_AT likes. */
export async function toggleLike(viewer: Viewer, postId: string) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { userId: true, parentId: true } });
  if (!post) throw new HttpError(404, "Пост не найден");
  const key = { userId_postId: { userId: viewer.id, postId } };
  const existing = await prisma.postLike.findUnique({ where: key, select: { userId: true } });
  let liked: boolean;
  if (existing) {
    await prisma.postLike.deleteMany({ where: { userId: viewer.id, postId } });
    liked = false;
  } else {
    try {
      await prisma.postLike.create({ data: { userId: viewer.id, postId } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
    liked = true;
  }
  const count = await prisma.postLike.count({ where: { postId } });
  if (liked && !post.parentId && count >= LIKE_REWARD_AT && post.userId !== viewer.id) {
    try {
      await prisma.dailyClaim.create({ data: { userId: post.userId, key: `like5:${postId}` } });
      await addCoins(post.userId, LIKE_REWARD, `like5:${postId}`);
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // already rewarded
    }
  }
  return { liked, count };
}

export async function deletePost(viewer: Viewer, id: string) {
  const p = await prisma.communityPost.findUnique({ where: { id }, select: { userId: true } });
  if (!p) throw new HttpError(404, "Пост не найден");
  if (p.userId !== viewer.id && !(await isAdmin(viewer))) throw new HttpError(403, "Можно удалять только свои посты");
  await prisma.communityPost.delete({ where: { id } });
}
