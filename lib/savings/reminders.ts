import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { PushPayload } from "@/lib/push/send";
import { goalImageUrl } from "./image";
import { MOTIVATION } from "./themes";

const DAY = 86_400_000;
const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Suggested daily amount: what's needed per day to hit the deadline, else ~1% of what's left, rounded to 100 ₽. */
function suggest(left: number, daysLeft: number | null): number {
  const raw = daysLeft && daysLeft > 0 ? left / daysLeft : left / 100;
  return Math.max(100, Math.min(left, Math.ceil(raw / 100) * 100));
}

/** Builds ONE motivational push for the user (or null if nothing to say). Rotates texts by day. */
export async function buildReminder(userId: string, now = new Date()): Promise<PushPayload | null> {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    select: { id: true, title: true, target: true, saved: true, deadline: true, image: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
  });
  const active = goals.filter((g) => g.saved < g.target);
  if (!active.length) return null;
  const dayN = Math.floor(now.getTime() / DAY);

  // 1) Deadline soon (≤ 14 days) and not done.
  const urgent = active
    .filter((g) => g.deadline && g.deadline.getTime() > now.getTime() && g.deadline.getTime() - now.getTime() <= 14 * DAY)
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0];
  const pick = (g: (typeof active)[number]) => ({ url: `/savings/${g.id}`, image: goalImageUrl(g) ?? undefined, tag: "pigsen-daily" });
  if (urgent) {
    const days = Math.ceil((urgent.deadline!.getTime() - now.getTime()) / DAY);
    const left = urgent.target - urgent.saved;
    return {
      title: `До срока «${urgent.title}» ${days} дн.`,
      body: `Осталось ${rub(left)} — это примерно ${rub(suggest(left, days))} в день. Ты справишься 🐷`,
      ...pick(urgent),
    };
  }

  // 2) Streak at risk: deposited yesterday but not today.
  const ids = active.map((g) => g.id);
  const today = new Date(`${dayKey(now)}T00:00:00Z`);
  const yesterday = new Date(today.getTime() - DAY);
  const [todayCount, yCount] = await Promise.all([
    prisma.savingsEntry.count({ where: { goalId: { in: ids }, amount: { gt: 0 }, createdAt: { gte: today } } }),
    prisma.savingsEntry.count({ where: { goalId: { in: ids }, amount: { gt: 0 }, createdAt: { gte: yesterday, lt: today } } }),
  ]);
  const g = active[dayN % active.length];
  const left = g.target - g.saved;
  const daysLeft = g.deadline ? Math.ceil((g.deadline.getTime() - now.getTime()) / DAY) : null;
  const amount = suggest(left, daysLeft);
  if (yCount > 0 && todayCount === 0) {
    return { title: "Не прерывай серию! 🔥", body: `Вчера ты отложил(а) деньги. Добавь хотя бы ${rub(amount)} в «${g.title}» сегодня 🐷`, ...pick(g) };
  }

  // 3) Rotating motivational text.
  const variants = [
    `До цели «${g.title}» осталось ${rub(left)} — отложи ${rub(amount)} сегодня 🐷`,
    `«${g.title}» уже на ${Math.min(99, Math.round((g.saved / g.target) * 100))}%. Ещё ${rub(amount)} — и ты ближе к мечте 🐷`,
    `${MOTIVATION[dayN % MOTIVATION.length]} Отложи ${rub(amount)} в «${g.title}» 🐷`,
  ];
  return { title: "Копилка Kapital", body: variants[dayN % variants.length], ...pick(g) };
}
