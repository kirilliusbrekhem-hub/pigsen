import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isPro } from "@/lib/billing/plan";
import { COINS } from "@/lib/coins/service";

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
export function liveStreak(streak: number, lastActiveDay: string, shielded = false): number {
  return lastActiveDay === day(0) || lastActiveDay === day(-1) || (shielded && lastActiveDay === day(-2)) ? streak : 0;
}

export interface XpResult {
  gained: number;
  coins: number;
  xp: number;
  streak: number;
  level: LevelInfo;
  leveledUp: boolean;
}

/** Adds XP and advances the daily streak. Safe to call with amount 0 to only record activity. */
export async function awardXp(userId: string, amount: number): Promise<XpResult> {
  const profile = await prisma.profile.upsert({ where: { userId }, update: {}, create: { userId } });
  const today = day(0);
  const pro = isPro(profile);
  // One missed day is forgiven for Pro, or by spending a streak freeze bought in the shop.
  const missedOne = profile.lastActiveDay === day(-2) && profile.streak > 0 && (pro || profile.streakFreezes > 0);
  const useFreeze = missedOne && !pro;
  const streak = profile.lastActiveDay === today ? profile.streak : profile.lastActiveDay === day(-1) || missedOne ? profile.streak + 1 : 1;
  // Every XP grant also pays PigCoin$: half the base XP on Free, equal to it on Pro (x2). The shop's x2 XP boost doubles XP only.
  const coins = Math.round(amount * COINS.perXp * (pro ? 2 : 1));
  if (profile.xpBoostUntil && profile.xpBoostUntil.getTime() > Date.now()) amount *= 2;
  const updated = await prisma.profile.update({
    where: { userId },
    data: {
      xp: { increment: amount },
      coins: { increment: coins },
      streak,
      bestStreak: Math.max(profile.bestStreak, streak),
      lastActiveDay: today,
      lastActiveAt: new Date(),
      ...(useFreeze ? { streakFreezes: { decrement: 1 } } : {}),
    },
  });
  if (coins > 0) await prisma.coinTx.create({ data: { userId, amount: coins, reason: "xp" } });
  const before = levelOf(profile.xp);
  const level = levelOf(updated.xp);
  return { gained: amount, coins, xp: updated.xp, streak: updated.streak, level, leveledUp: level.index > before.index };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  /** Tiered badges: brand tier name (Росток → Побег → Дерево) and progress towards the target. */
  tier?: BadgeTier;
  progress?: number;
  target?: number;
}

export type BadgeTier = "Росток" | "Побег" | "Дерево";
const TIERS: BadgeTier[] = ["Росток", "Побег", "Дерево"];

/** Tiered badge families: one badge per tier, unlocked by a counter reaching the tier's target. */
const FAMILIES: { id: string; name: string; icon: string; what: (n: number) => string; targets: [number, number, number]; stat: keyof Counters }[] = [
  { id: "learner", name: "Ученик", icon: "cap", what: (n) => `Пройти ${n} уроков`, targets: [10, 25, 50], stat: "lessons" },
  { id: "quizzer", name: "Квизёр", icon: "bulb", what: (n) => `Пройти ${n} квизов`, targets: [5, 15, 40], stat: "quizzes" },
  { id: "sniper", name: "Снайпер", icon: "target", what: (n) => `${n} квизов без единой ошибки`, targets: [3, 10, 25], stat: "perfect" },
  { id: "marathon", name: "Марафонец", icon: "flame", what: (n) => `Серия ${n} дней подряд`, targets: [14, 30, 100], stat: "bestStreak" },
  { id: "saver", name: "Копилочник", icon: "piggy", what: (n) => `${n} взносов в копилку`, targets: [5, 20, 50], stat: "deposits" },
  { id: "goal", name: "Цель достигнута", icon: "trophy", what: (n) => `Накопить на ${n} ${n === 1 ? "цель" : "цели"}`, targets: [1, 3, 5], stat: "goalsDone" },
  { id: "talker", name: "Собеседник $PIG", icon: "message", what: (n) => `${n} разговоров с $PIG`, targets: [5, 20, 50], stat: "convos" },
  { id: "quester", name: "Квестовик", icon: "star", what: (n) => `Выполнить ${n} заданий дня`, targets: [5, 25, 75], stat: "quests" },
  { id: "lucky", name: "Везунчик", icon: "sparkle", what: (n) => `Крутить колесо удачи ${n} дней`, targets: [3, 14, 45], stat: "spins" },
];

interface Counters {
  lessons: number;
  quizzes: number;
  perfect: number;
  bestStreak: number;
  deposits: number;
  goalsDone: number;
  convos: number;
  quests: number;
  spins: number;
}

function tieredBadges(c: Counters): Badge[] {
  return FAMILIES.flatMap((f) =>
    f.targets.map((target, i) => ({
      id: `${f.id}-${i + 1}`,
      name: `${f.name} · ${TIERS[i]}`,
      description: f.what(target),
      icon: f.icon,
      earned: c[f.stat] >= target,
      tier: TIERS[i],
      progress: Math.min(c[f.stat], target),
      target,
    })),
  );
}

/** The unearned badge closest to completion, for the dashboard. */
export function nextBadge(badges: Badge[]): Badge | null {
  const open = badges.filter((b) => !b.earned && b.target);
  open.sort((a, b) => (b.progress ?? 0) / b.target! - (a.progress ?? 0) / a.target! || a.target! - b.target!);
  return open[0] ?? null;
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
  const [profile, lessons, perfectQuiz, quizzes, saved, convos, ideas, courses, doneByCourse] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { xp: true, streak: true, bestStreak: true, lastActiveDay: true, proUntil: true, streakFreezes: true } }),
    prisma.progress.count({ where: { userId, status: "completed" } }),
    prisma.quizAttempt.findFirst({ where: { userId, completedAt: { not: null }, score: { gt: 0 } }, select: { score: true, total: true }, orderBy: { score: "desc" } }),
    prisma.quizAttempt.count({ where: { userId, completedAt: { not: null } } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.conversation.count({ where: { userId } }),
    prisma.ideaReview.count({ where: { userId } }),
    prisma.course.findMany({ select: { id: true, _count: { select: { lessons: true } } } }),
    prisma.lesson.groupBy({ by: ["courseId"], where: { progress: { some: { userId, status: "completed" } } }, _count: { _all: true } }),
  ]);
  const [perfectRow, deposits, goalRow, quests, spins] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "QuizAttempt" WHERE "userId" = ${userId} AND "completedAt" IS NOT NULL AND "total" > 0 AND "score" = "total"`,
    prisma.savingsEntry.count({ where: { goal: { userId }, amount: { gt: 0 } } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "SavingsGoal" WHERE "userId" = ${userId} AND "saved" >= "target" AND "target" > 0`,
    prisma.dailyClaim.count({ where: { userId, key: { startsWith: "quest:d:" }, NOT: { key: { endsWith: ":chest" } } } }),
    prisma.dailyClaim.count({ where: { userId, key: { startsWith: "spin:" } } }),
  ]);
  const xp = profile?.xp ?? 0;
  const streak = liveStreak(profile?.streak ?? 0, profile?.lastActiveDay ?? "", isPro(profile) || (profile?.streakFreezes ?? 0) > 0);
  const bestStreak = Math.max(profile?.bestStreak ?? 0, streak);
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
    ...tieredBadges({
      lessons,
      quizzes,
      perfect: Number(perfectRow[0]?.n ?? 0),
      bestStreak,
      deposits,
      goalsDone: Number(goalRow[0]?.n ?? 0),
      convos,
      quests,
      spins,
    }),
  ];
  return { xp, streak, level: levelOf(xp), badges };
}
