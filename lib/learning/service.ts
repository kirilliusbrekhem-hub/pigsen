import "server-only";
import type { Category, Course, Lesson, Progress } from "@prisma/client";
import { activateReferral } from "@/lib/growth/referral";
import { isUniqueViolation } from "@/lib/db/lock";
import { prisma } from "@/lib/db/prisma";
import { toCategoryDTO } from "@/lib/content/mappers";
import { getSavedIds } from "@/lib/content/saved";
import type { CourseProgressDTO } from "@/types";
import { assertLessonAccess } from "./premium";

type CourseWithLessons = Course & { category: Category; contentItem?: { premium: boolean } | null; lessons: Array<Lesson & { progress: Progress[] }> };

function toCourseProgress(c: CourseWithLessons, saved: Set<string>): CourseProgressDTO {
  const lessons = [...c.lessons].sort((a, b) => a.order - b.order);
  const completed = lessons.filter((l) => l.progress.some((p) => p.status === "completed"));
  const next = lessons.find((l) => !l.progress.some((p) => p.status === "completed")) ?? null;
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    level: c.level,
    category: toCategoryDTO(c.category),
    totalLessons: lessons.length,
    completedLessons: completed.length,
    percent: lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0,
    totalMinutes: lessons.reduce((s, l) => s + l.durationMin, 0),
    nextLessonSlug: next?.slug ?? null,
    nextLessonTitle: next?.title ?? null,
    started: lessons.some((l) => l.progress.length > 0),
    contentItemId: c.contentItemId,
    saved: c.contentItemId ? saved.has(c.contentItemId) : false,
    premium: !!c.contentItem?.premium,
  };
}

const courseInclude = (userId: string) => ({
  category: true,
  contentItem: { select: { premium: true } },
  lessons: { include: { progress: { where: { userId } } }, orderBy: { order: "asc" as const } },
});

export async function listCoursesWithProgress(userId: string, category?: string): Promise<CourseProgressDTO[]> {
  const [rows, saved] = await Promise.all([
    prisma.course.findMany({
      where: category ? { category: { slug: category } } : {},
      include: courseInclude(userId),
      orderBy: { order: "asc" },
    }),
    getSavedIds(userId),
  ]);
  return rows.map((c) => toCourseProgress(c, saved));
}

export async function getCourseWithProgress(userId: string, slug: string) {
  const [course, saved] = await Promise.all([
    prisma.course.findUnique({ where: { slug }, include: courseInclude(userId) }),
    getSavedIds(userId),
  ]);
  if (!course) return null;
  return {
    course: toCourseProgress(course, saved),
    lessons: course.lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      summary: l.summary,
      order: l.order,
      durationMin: l.durationMin,
      status: (l.progress[0]?.status ?? "not_started") as "not_started" | "in_progress" | "completed",
    })),
  };
}

export async function getLesson(userId: string, courseSlug: string, lessonSlug: string) {
  const data = await getCourseWithProgress(userId, courseSlug);
  if (!data) return null;
  const idx = data.lessons.findIndex((l) => l.slug === lessonSlug);
  if (idx < 0) return null;
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: data.lessons[idx].id } });
  return {
    ...data,
    lesson: { ...data.lessons[idx], body: lesson.body },
    prev: data.lessons[idx - 1] ?? null,
    next: data.lessons[idx + 1] ?? null,
  };
}

/** Marks a lesson as opened. Never downgrades a completed lesson. */
export async function startLesson(userId: string, lessonId: string) {
  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: {},
    create: { userId, lessonId, status: "in_progress" },
  });
}

/** Returns null for an unknown lesson; `firstCompletion` is true only the first time a lesson is completed. */
export async function setLessonCompleted(userId: string, lessonId: string, completed: boolean) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return null;
  await assertLessonAccess(userId, lessonId);
  const where = { userId_lessonId: { userId, lessonId } };
  // completedAt survives un-completing, so re-completing a lesson never pays XP twice.
  // First completion is decided atomically: only the call whose update sets completedAt wins.
  let firstCompletion = false;
  if (completed) {
    const setFirst = () => prisma.progress.updateMany({ where: { userId, lessonId, completedAt: null }, data: { status: "completed", completedAt: new Date() } });
    let r = await setFirst();
    if (!r.count) {
      const exists = await prisma.progress.findUnique({ where, select: { id: true } });
      if (!exists) {
        try {
          await prisma.progress.create({ data: { userId, lessonId, status: "completed", completedAt: new Date() } });
          r = { count: 1 };
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
          r = await setFirst();
        }
      }
    }
    firstCompletion = r.count > 0;
    if (!firstCompletion) await prisma.progress.update({ where, data: { status: "completed" } });
  } else {
    await prisma.progress.upsert({ where, update: { status: "in_progress" }, create: { userId, lessonId, status: "in_progress" } });
  }
  const progress = await prisma.progress.findUniqueOrThrow({ where });
  if (firstCompletion) {
    // A completed lesson activates a pending referral (idempotent); never block lesson completion on it.
    await activateReferral(userId).catch((e) => console.error("[referral] activate failed", e));
  }
  return { progress, firstCompletion };
}

export async function learningStats(userId: string) {
  const [completed, inProgressLessons, totalLessons, completedRows] = await Promise.all([
    prisma.progress.count({ where: { userId, status: "completed" } }),
    prisma.progress.findMany({ where: { userId }, select: { lesson: { select: { courseId: true } } } }),
    prisma.lesson.count(),
    prisma.progress.findMany({ where: { userId, status: "completed" }, select: { lesson: { select: { durationMin: true } } } }),
  ]);
  const coursesStarted = new Set(inProgressLessons.map((p) => p.lesson.courseId)).size;
  return {
    lessonsCompleted: completed,
    totalLessons,
    coursesStarted,
    minutesLearned: completedRows.reduce((s, r) => s + r.lesson.durationMin, 0),
    percent: totalLessons ? Math.round((completed / totalLessons) * 100) : 0,
  };
}

/** Completed lessons per day for the last `days` days (oldest first). */
export async function learningActivity(userId: string, days = 14) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const rows = await prisma.progress.findMany({
    where: { userId, status: "completed", completedAt: { gte: since } },
    select: { completedAt: true },
  });
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return { date: d.toISOString().slice(0, 10), count: 0 };
  });
  for (const r of rows) {
    if (!r.completedAt) continue;
    const local = new Date(r.completedAt);
    local.setHours(0, 0, 0, 0);
    const idx = Math.round((local.getTime() - since.getTime()) / 86_400_000);
    if (buckets[idx]) buckets[idx].count += 1;
  }
  return buckets;
}

export async function learningHistory(userId: string, take = 20) {
  const rows = await prisma.progress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take,
    include: { lesson: { include: { course: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status as "in_progress" | "completed",
    at: (r.status === "completed" && r.completedAt ? r.completedAt : r.updatedAt).toISOString(),
    lessonTitle: r.lesson.title,
    courseTitle: r.lesson.course.title,
    href: `/learn/${r.lesson.course.slug}/${r.lesson.slug}`,
  }));
}
