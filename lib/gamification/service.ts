import "server-only";
import { prisma } from "@/lib/db/prisma";

export const XP = {
  lessonCompleted: 20,
  quizCorrect: 10,
  ideaReview: 15,
} as const;

const LEVELS = [
  { min: 0, name: "Стажёр" },
  { min: 100, name: "Аналитик" },
  { min: 300, name: "Предприниматель" },
  { min: 700, name: "Инвестор" },
  { min: 1500, name: "Венчурный партнёр" },
  { min: 3000, name: "Магнат" },
];

export interface LevelInfo {
  index: number;
  name: string;
  min: number;
  nextMin: number | null;
  nextName: string | null;
  /** 0–100 progress towards the next level. */
  percent: number;
}

export function levelOf(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  return {
    index: i + 1,
    name: cur.name,
    min: cur.min,
    nextMin: next?.min ?? null,
    nextName: next?.name ?? null,
    percent: next ? Math.round(((xp - cur.min) / (next.min - cur.min)) * 100) : 100,
  };
}

/** Calendar day in UTC as YYYY-MM-DD, offset by `deltaDays`. */
function day(deltaDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** A streak stays alive if the user was active today or yesterday. */
export function liveStreak(streak: number, lastActiveDay: string): number {
  return lastActiveDay === day(0) || lastActiveDay === day(-1) ? streak : 0;
}

export interface XpResult {
  gained: number;
  xp: number;
  streak: number;
  level: LevelInfo;
  leveledUp: boolean;
}

/** Adds XP and advances the daily streak. Safe to call with amount 0 to only record activity. */
export async function awardXp(userId: string, amount: number): Promise<XpResult> {
  const profile = await prisma.profile.upsert({ where: { userId }, update: {}, create: { userId } });
  const today = day(0);
  const streak = profile.lastActiveDay === today ? profile.streak : profile.lastActiveDay === day(-1) ? profile.streak + 1 : 1;
  const updated = await prisma.profile.update({
    where: { userId },
    data: { xp: { increment: amount }, streak, lastActiveDay: today, lastActiveAt: new Date() },
  });
  const before = levelOf(profile.xp);
  const level = levelOf(updated.xp);
  return { gained: amount, xp: updated.xp, streak: updated.streak, level, leveledUp: level.index > before.index };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

export interface GameStats {
  xp: number;
  streak: number;
  level: LevelInfo;
  badges: Badge[];
}

/** Never throws: the dashboard and profile still render (with empty stats) if a query fails. */
export async function getGameStats(userId: string): Promise<GameStats> {
  try {
    return await loadGameStats(userId);
  } catch (err) {
    console.error("[game] stats failed", err instanceof Error ? err.message : err);
    return { xp: 0, streak: 0, level: levelOf(0), badges: [] };
  }
}

async function loadGameStats(userId: string): Promise<GameStats> {
  const [profile, lessons, perfectQuiz, quizzes, saved, convos, ideas, courses] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { xp: true, streak: true, lastActiveDay: true } }),
    prisma.progress.count({ where: { userId, status: "completed" } }),
    prisma.quizAttempt.findFirst({ where: { userId, completedAt: { not: null }, score: { gt: 0 } }, select: { score: true, total: true }, orderBy: { score: "desc" } }),
    prisma.quizAttempt.count({ where: { userId, completedAt: { not: null } } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.conversation.count({ where: { userId } }),
    prisma.ideaReview.count({ where: { userId } }),
    prisma.course.findMany({ select: { id: true, _count: { select: { lessons: true } } } }),
  ]);
  const doneByCourse = await prisma.lesson.groupBy({ by: ["courseId"], where: { progress: { some: { userId, status: "completed" } } }, _count: { _all: true } });
  const xp = profile?.xp ?? 0;
  const streak = liveStreak(profile?.streak ?? 0, profile?.lastActiveDay ?? "");
  const bestStreak = profile?.streak ?? 0;
  const courseDone = courses.some((c) => c._count.lessons > 0 && doneByCourse.some((d) => d.courseId === c.id && d._count._all >= c._count.lessons));
  const perfect = !!perfectQuiz && perfectQuiz.score === perfectQuiz.total;

  const badges: Badge[] = [
    { id: "first-lesson", name: "Первый шаг", description: "Пройти первый урок", icon: "check", earned: lessons >= 1 },
    { id: "five-lessons", name: "В ритме", description: "Пройти 5 уроков", icon: "cap", earned: lessons >= 5 },
    { id: "course", name: "Выпускник", description: "Завершить целый курс", icon: "target", earned: courseDone },
    { id: "quiz", name: "Знаток", description: "Пройти квиз после урока", icon: "bulb", earned: quizzes >= 1 },
    { id: "perfect", name: "Без ошибок", description: "Ответить на все вопросы квиза верно", icon: "sparkle", earned: perfect },
    { id: "streak-3", name: "Огонёк", description: "Заниматься 3 дня подряд", icon: "rocket", earned: bestStreak >= 3 },
    { id: "streak-7", name: "Неделя силы", description: "Заниматься 7 дней подряд", icon: "cal", earned: bestStreak >= 7 },
    { id: "pig", name: "Друг $PIG", description: "Начать разговор с $PIG", icon: "message", earned: convos >= 1 },
    { id: "collector", name: "Коллекционер", description: "Сохранить 5 материалов", icon: "bookmark", earned: saved >= 5 },
    { id: "founder", name: "Фаундер", description: "Получить разбор бизнес-идеи", icon: "briefcase", earned: ideas >= 1 },
  ];
  return { xp, streak, level: levelOf(xp), badges };
}
