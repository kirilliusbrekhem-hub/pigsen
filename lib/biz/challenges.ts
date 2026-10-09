import "server-only";
import { prisma } from "@/lib/db/prisma";
import { challengeItemFor } from "./catalog";
import { confirmedSavings } from "@/lib/savings/proof";

/**
 * Savings challenges that feed the business. A member sends a short proof (text + optional photo); an admin approves it
 * at /admin/challenges. The reward is the challenge's unique item for the team's business (never sold for capital),
 * a small rating boost and a few PigCoin$ — never extra capital, so capital keeps mirroring real savings exactly.
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

/** Net savings this week that count publicly: only deposits confirmed by a bank screenshot, minus withdrawals. */
async function netSavedThisWeek(userId: string) {
  const { start } = weekStart();
  return Math.max(0, await confirmedSavings(userId, start));
}

/**
 * Weekly progress is shown as a hint for the reviewer; completion itself happens only when an admin approves the
 * team's proof (lib/biz/proofs.ts). The reward is the challenge's unique business item (ch-*), once per team.
 */
export async function challengeView(businessId: string, userId: string) {
  const saved = await netSavedThisWeek(userId);
  const subs = await prisma.challengeSubmission.findMany({
    where: { source: "biz", OR: [{ businessId }, { userId }] },
    orderBy: { createdAt: "desc" },
    select: { challengeId: true, status: true, comment: true, userId: true, businessId: true },
  });
  return CHALLENGES.map((c) => {
    const item = challengeItemFor("biz", c.id)!;
    const approved = subs.find((s) => s.challengeId === c.id && s.status === "approved" && s.businessId === businessId);
    const mine = subs.find((s) => s.challengeId === c.id && s.userId === userId && s.businessId === businessId);
    const status = approved ? "approved" : (mine?.status ?? "none");
    return { ...c, progress: Math.min(saved, c.target), status, comment: status === "rejected" ? (mine?.comment ?? "") : "", item: { id: item.id, title: item.title, blurb: item.blurb } };
  });
}

export { netSavedThisWeek };
