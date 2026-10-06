import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { addCoins, extendPro } from "@/lib/coins/service";
import { HttpError } from "@/lib/api/http";
import { sanitizeText } from "@/lib/validation/schemas";

export const REVIEW_REWARD = { coins: 300, proDays: 3 } as const;

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().transform(sanitizeText).pipe(z.string().min(30, "Минимум 30 символов").max(1000, "Максимум 1000 символов")),
});

export async function myReview(userId: string) {
  return prisma.review.findUnique({ where: { userId } });
}

export async function upsertReview(userId: string, input: z.infer<typeof reviewSchema>) {
  const existing = await myReview(userId);
  if (existing && existing.status !== "pending") throw new HttpError(409, "Отзыв уже проверен, изменить его нельзя");
  if (existing) {
    const r = await prisma.review.updateMany({ where: { id: existing.id, status: "pending" }, data: input });
    if (!r.count) throw new HttpError(409, "Отзыв уже проверен, изменить его нельзя");
    return prisma.review.findUnique({ where: { userId } });
  }
  try {
    return await prisma.review.create({ data: { userId, ...input } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "Отзыв уже отправлен");
    throw e;
  }
}

export async function listReviews(status: string) {
  return prisma.review.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

/** pending → approved/rejected exactly once; the reward is paid only on that transition. */
export async function moderateReview(id: string, action: "approve" | "reject") {
  const status = action === "approve" ? "approved" : "rejected";
  const review = await prisma.review.findUnique({ where: { id }, select: { userId: true } });
  if (!review) throw new HttpError(404, "Отзыв не найден");
  const r = await prisma.review.updateMany({ where: { id, status: "pending" }, data: { status } });
  if (!r.count) throw new HttpError(409, "Отзыв уже проверен");
  if (status === "approved") {
    await addCoins(review.userId, REVIEW_REWARD.coins, "review");
    await extendPro(review.userId, REVIEW_REWARD.proDays);
  }
  return { status };
}
