import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";

export const PREMIUM_MESSAGE = "Это эксклюзивный материал Pro. Оформите Pro, чтобы открыть его полностью.";

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const p = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
  return isPro(p);
}

/** In a premium course the first lesson is a free preview; the rest need Pro. */
export const lessonLocked = (premium: boolean, order: number, pro: boolean) => premium && order > 1 && !pro;

export async function assertLessonAccess(userId: string, lessonId: string) {
  const l = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { order: true, course: { select: { contentItem: { select: { premium: true } } } } } });
  if (!l) return;
  if (lessonLocked(!!l.course.contentItem?.premium, l.order, await hasPremiumAccess(userId))) throw new HttpError(403, PREMIUM_MESSAGE);
}
