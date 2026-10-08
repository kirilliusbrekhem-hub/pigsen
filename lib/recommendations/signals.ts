import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { parseInterests } from "@/lib/profile/service";
import { queryTerms } from "@/lib/search/normalize";
import type { UserSignals } from "./types";

/** Deduped per request (the dashboard asks for recommendations and the interest profile). */
export const collectSignals = cache(async (userId: string): Promise<UserSignals> => {
  const [profile, saved, views, progress, searches] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { interests: true } }),
    prisma.savedItem.findMany({ where: { userId }, select: { contentItemId: true, contentItem: { select: { categoryId: true } } } }),
    prisma.contentView.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { contentItemId: true, contentItem: { select: { categoryId: true } } },
    }),
    prisma.progress.findMany({
      where: { userId, status: "completed" },
      select: { lesson: { select: { course: { select: { categoryId: true, contentItemId: true, lessons: { select: { id: true } } } } } } },
    }),
    prisma.searchQuery.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10, select: { query: true } }),
  ]);

  // A course counts as completed for recommendation purposes when all lessons are done.
  const completedByCourse = new Map<string, { total: number; done: number }>();
  for (const p of progress) {
    const c = p.lesson.course;
    if (!c.contentItemId) continue;
    const entry = completedByCourse.get(c.contentItemId) ?? { total: c.lessons.length, done: 0 };
    entry.done += 1;
    completedByCourse.set(c.contentItemId, entry);
  }

  return {
    interests: parseInterests(profile),
    savedCategoryIds: saved.map((s) => s.contentItem.categoryId),
    viewedCategoryIds: views.map((v) => v.contentItem.categoryId),
    completedCategoryIds: progress.map((p) => p.lesson.course.categoryId),
    searchTerms: searches.flatMap((s) => queryTerms(s.query)),
    savedIds: new Set(saved.map((s) => s.contentItemId)),
    viewedIds: new Set(views.map((v) => v.contentItemId)),
    completedCourseItemIds: new Set([...completedByCourse].filter(([, v]) => v.done >= v.total).map(([k]) => k)),
  };
});
