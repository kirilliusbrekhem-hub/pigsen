import "server-only";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { HttpError } from "@/lib/api/http";
import { addCoins } from "@/lib/coins/service";
import { clampRating } from "./engine";

/**
 * Savings challenges that feed the business. They complete only through real savings: progress is the member's net
 * deposits (deposits minus withdrawals) mirrored into the business this week. The reward is a game boost (rating) and a
 * few PigCoin$ — never extra capital, so capital keeps mirroring real savings exactly.
 */
export interface ChallengeDef {
  id: string;
  title: string;
  blurb: string;
  target: number;
  rating: number;
  coins: number;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: "nodelivery", title: "Неделя без доставки", blurb: "Не заказывайте еду — отложите сэкономленное в копилку", target: 1500, rating: 0.2, coins: 10 },
  { id: "nocoffee", title: "Кофе из дома", blurb: "Варите кофе дома, а разницу — в копилку", target: 700, rating: 0.15, coins: 8 },
  { id: "nosubs", title: "Минус подписка", blurb: "Отмените ненужную подписку и отложите её цену", target: 400, rating: 0.1, coins: 6 },
  { id: "bigweek", title: "Неделя накоплений", blurb: "Отложите заметную сумму за неделю", target: 5000, rating: 0.3, coins: 15 },
];

/** Monday 00:00 UTC of the current week + its key. */
export function weekStart(d = new Date()): { start: Date; key: string } {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - ((s.getUTCDay() + 6) % 7));
  return { start: s, key: s.toISOString().slice(0, 10) };
}

async function netSavedThisWeek(businessId: string, userId: string) {
  const { start } = weekStart();
  const r = await prisma.bizEvent.aggregate({ where: { businessId, userId, kind: { in: ["deposit", "withdraw"] }, createdAt: { gte: start } }, _sum: { amount: true } });
  return Math.max(0, r._sum.amount ?? 0);
}

export async function challengeView(businessId: string, userId: string) {
  const { key } = weekStart();
  const saved = await netSavedThisWeek(businessId, userId);
  const done = new Set((await prisma.dailyClaim.findMany({ where: { userId, key: { startsWith: `biz-ch:${key}:` } }, select: { key: true } })).map((c) => c.key.split(":").pop()));
  return CHALLENGES.map((c) => ({ ...c, progress: Math.min(saved, c.target), claimed: done.has(c.id) }));
}

export async function claimChallenge(userId: string, id: string) {
  const def = CHALLENGES.find((c) => c.id === id);
  if (!def) throw new HttpError(404, "Челлендж не найден");
  const m = await prisma.bizMember.findUnique({ where: { userId } });
  if (!m) throw new HttpError(404, "У вас пока нет бизнеса");
  if ((await netSavedThisWeek(m.businessId, userId)) < def.target) throw new HttpError(409, `Отложите в копилку ${def.target.toLocaleString("ru-RU")} ₽ за неделю, чтобы выполнить`);
  const { key } = weekStart();
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `biz:${m.businessId}`);
    const ins = await tx.dailyClaim.createMany({ data: [{ userId, key: `biz-ch:${key}:${id}` }], skipDuplicates: true });
    if (!ins.count) throw new HttpError(409, "Уже выполнено на этой неделе");
    const b = await tx.bizBusiness.findUniqueOrThrow({ where: { id: m.businessId } });
    await tx.bizBusiness.update({ where: { id: b.id }, data: { rating: clampRating(b.rating + def.rating) } });
    await tx.bizEvent.create({ data: { businessId: b.id, kind: "challenge", text: `${m.name} выполнил(а) челлендж «${def.title}» — рейтинг +${def.rating}`, userId } });
  });
  return addCoins(userId, def.coins, `biz-ch:${id}`);
}
