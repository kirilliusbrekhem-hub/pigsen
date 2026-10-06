import "server-only";
import { prisma } from "@/lib/db/prisma";
import { limitsFor, startOfUtcDay, tierOf, type LimitKind, type Tier } from "./plan";

/** Extra $PIG questions per "boost-chat" purchase, valid for the day it was bought. */
export const CHAT_BOOST = 10;

export interface Usage {
  tier: Tier;
  used: number;
  limit: number; // Infinity on Pro
  left: number;
}

/** Today's usage of a daily allowance. Counters live in the coin ledger as zero-amount rows. */
export async function usage(userId: string, kind: LimitKind): Promise<Usage> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true, liteUntil: true } });
  const tier = tierOf(profile);
  let limit = limitsFor(profile)[kind];
  if (tier === "pro") return { tier, used: 0, limit, left: Infinity };
  const since = startOfUtcDay();
  const used =
    kind === "idea"
      ? await prisma.ideaReview.count({ where: { userId, createdAt: { gte: since } } })
      : await prisma.coinTx.count({ where: { userId, reason: `use:${kind}`, createdAt: { gte: since } } });
  if (kind === "chat") limit += CHAT_BOOST * (await prisma.coinTx.count({ where: { userId, reason: "shop:boost-chat", createdAt: { gte: since } } }));
  return { tier, used, limit, left: Math.max(0, limit - used) };
}

/** Records one use; returns false when today's allowance is spent. */
export async function consumeAllowance(userId: string, kind: Exclude<LimitKind, "idea">): Promise<boolean> {
  const u = await usage(userId, kind);
  if (u.tier === "pro") return true;
  if (u.left <= 0) return false;
  await prisma.coinTx.create({ data: { userId, amount: 0, reason: `use:${kind}` } });
  return true;
}
