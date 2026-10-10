import "server-only";
import { trackQuest } from "@/lib/gamification/quests";
import { prisma } from "@/lib/db/prisma";
import { COINS, addCoins, addDailyCoins, ownedItems } from "@/lib/coins/service";
import { goalLimit, isPro } from "@/lib/billing/plan";
import { HttpError } from "@/lib/api/http";
import { THEMES } from "./themes";
import { onSavingsChange } from "@/lib/biz/service";

export interface GoalStats {
  percent: number;
  left: number;
  /** Average saved per day over the last 60 days (net of withdrawals). */
  pacePerDay: number;
  /** Rubles per month needed to finish by the deadline, if any. */
  needPerMonth: number | null;
  /** Estimated finish date at the current pace. */
  eta: Date | null;
  daysLeft: number | null;
}

export async function goalStats(goal: { id: string; target: number; saved: number; deadline: Date | null; createdAt: Date }): Promise<GoalStats> {
  const since = new Date(Date.now() - 60 * 86_400_000);
  const recent = await prisma.savingsEntry.aggregate({ where: { goalId: goal.id, createdAt: { gte: since } }, _sum: { amount: true } });
  const span = Math.max(30, Math.min(60, (Date.now() - goal.createdAt.getTime()) / 86_400_000));
  const pacePerDay = Math.max(0, (recent._sum.amount ?? 0) / span);
  const left = Math.max(0, goal.target - goal.saved);
  const daysLeft = goal.deadline ? Math.ceil((goal.deadline.getTime() - Date.now()) / 86_400_000) : null;
  const needPerMonth = daysLeft !== null ? (daysLeft > 0 ? Math.ceil((left / daysLeft) * 30) : left) : null;
  const eta = left === 0 ? new Date() : pacePerDay > 0 ? new Date(Date.now() + (left / pacePerDay) * 86_400_000) : null;
  return { percent: goal.target ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0, left, pacePerDay, needPerMonth, eta, daysLeft };
}

export async function listGoals(userId: string) {
  return prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function getGoal(userId: string, id: string) {
  return prisma.savingsGoal.findFirst({ where: { id, userId } });
}

export async function availableThemes(userId: string, pro: boolean): Promise<Set<string>> {
  return themesFrom(await ownedItems(userId), pro);
}

/** Themes unlocked by the plan or by shop purchases (`owned` = ownedItems(userId)). */
export function themesFrom(owned: Set<string>, pro: boolean): Set<string> {
  return new Set(THEMES.filter((t) => !t.premium || pro || owned.has(`theme-${t.id}`)).map((t) => t.id));
}

export async function createGoal(userId: string, input: { title: string; why: string; target: number; theme: string; deadline: Date | null; initial: number; image?: string | null }) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true, liteUntil: true, extraGoals: true } });
  const pro = isPro(profile);
  const maxGoals = goalLimit(profile);
  if ((await prisma.savingsGoal.count({ where: { userId } })) >= maxGoals) {
    throw new HttpError(402, `На вашем плане до ${maxGoals} целей. С Pro целей сколько угодно, или удалите старую цель.`);
  }
  if (!(await availableThemes(userId, pro)).has(input.theme)) throw new HttpError(403, "Эта обложка доступна в Pro или в магазине за PigCoin$");
  const goal = await prisma.savingsGoal.create({
    data: { userId, title: input.title, why: input.why, target: input.target, theme: input.theme, deadline: input.deadline, image: input.image ?? null },
  });
  if (input.initial > 0) return (await addEntry(userId, goal.id, Math.min(input.initial, MAX_SAVED), "Стартовый взнос", true)).goal;
  return goal;
}

export async function updateGoal(userId: string, id: string, data: { title?: string; why?: string; target?: number; theme?: string; deadline?: Date | null; image?: string | null }) {
  const goal = await getGoal(userId, id);
  if (!goal) throw new HttpError(404, "Цель не найдена");
  if (data.theme && data.theme !== goal.theme) {
    const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
    if (!(await availableThemes(userId, isPro(profile))).has(data.theme)) throw new HttpError(403, "Эта обложка доступна в Pro или в магазине за PigCoin$");
  }
  // Milestones never go down: lowering the target can't re-arm already reached (and paid) steps.
  return prisma.savingsGoal.update({ where: { id }, data });
}

export async function deleteGoal(userId: string, id: string) {
  const r = await prisma.savingsGoal.deleteMany({ where: { id, userId } });
  if (!r.count) throw new HttpError(404, "Цель не найдена");
}

const MAX_SAVED = 1_500_000_000; // stays well inside Postgres INT
const MILESTONE_MIN_AGE_MS = 3 * 86_400_000; // no milestone coins on a goal created minutes ago
const MILESTONES_PER_DAY = 2;

/** Inserts a one-time claim key; true only for the caller that inserted it. */
const claimKey = async (userId: string, key: string) => (await prisma.dailyClaim.createMany({ data: [{ userId, key }], skipDuplicates: true })).count > 0;

/**
 * Deposit (+) or withdrawal (-). Pays daily coins for deposits and a bonus for each new 25% milestone.
 * `opening` marks the starting amount entered when the goal is created: it never earns milestone coins.
 */
export async function addEntry(userId: string, goalId: string, amount: number, note: string, opening = false) {
  const goal = await getGoal(userId, goalId);
  if (!goal) throw new HttpError(404, "Цель не найдена");
  // The balance guard runs inside the UPDATE, so parallel withdrawals can't push it below zero.
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.savingsGoal.updateMany({
      where: { id: goalId, userId, saved: amount < 0 ? { gte: -amount } : { lte: MAX_SAVED - amount } },
      data: { saved: { increment: amount } },
    });
    if (!r.count) throw new HttpError(422, amount < 0 ? "Нельзя снять больше, чем накоплено" : "Слишком большая сумма в копилке");
    const entry = await tx.savingsEntry.create({ data: { goalId, amount, note } });
    return { ...(await tx.savingsGoal.findUniqueOrThrow({ where: { id: goalId } })), entryId: entry.id };
  });
  await onSavingsChange(userId, amount); // «Мой бизнес» mirrors every real deposit/withdrawal
  let coins = 0;
  let milestone: number | null = null;
  const step = Math.min(4, Math.floor((updated.saved / updated.target) * 4));
  if (opening) {
    // Count the starting amount as already-reached milestones, without paying for them.
    if (step > updated.milestones) await prisma.savingsGoal.update({ where: { id: goalId }, data: { milestones: step } });
  } else if (amount > 0) {
    coins += await addDailyCoins(userId, COINS.dailyDeposit, "deposit");
    await trackQuest(userId, "deposit");
    if (step > updated.milestones) {
      // Claim atomically so two parallel deposits can't both pay the same milestone.
      const claimed = await prisma.savingsGoal.updateMany({ where: { id: goalId, milestones: { lt: step } }, data: { milestones: step } });
      if (claimed.count) {
        milestone = step * 25;
        // Coins only for goals older than 3 days and at most twice a day, so create/delete loops can't farm them.
        // Both limits are claim keys: whichever request inserts first wins, parallel ones get nothing.
        if (Date.now() - goal.createdAt.getTime() >= MILESTONE_MIN_AGE_MS && (await claimKey(userId, `milestone:${goalId}:${step}`))) {
          const day = new Date().toISOString().slice(0, 10);
          for (let n = 1; n <= MILESTONES_PER_DAY; n++) {
            if (await claimKey(userId, `milestone-day:${day}:${n}`)) {
              coins += await addCoins(userId, COINS.milestone, `milestone:${goalId}:${step}`);
              break;
            }
          }
        }
      }
    }
  }
  const goalNow = await prisma.savingsGoal.findUniqueOrThrow({ where: { id: goalId } });
  return { goal: goalNow, coins, milestone, entryId: updated.entryId };
}

export async function listEntries(goalId: string) {
  return prisma.savingsEntry.findMany({ where: { goalId }, orderBy: { createdAt: "desc" }, take: 50, include: { proof: { select: { status: true } } } });
}

/** One-line summary of the user's goals for CAP's system prompt. */
export async function savingsSummary(userId: string): Promise<string> {
  const goals = await prisma.savingsGoal.findMany({ where: { userId }, take: 5, orderBy: { createdAt: "asc" } });
  if (!goals.length) return "целей накоплений пока нет";
  return goals
    .map((g) => `«${g.title}»: ${g.saved.toLocaleString("ru-RU")} из ${g.target.toLocaleString("ru-RU")} ₽${g.deadline ? ` до ${g.deadline.toISOString().slice(0, 10)}` : ""}`)
    .join("; ");
}
