import "server-only";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { limitsFor, startOfUtcDay, tierOf, type LimitKind, type Tier } from "./plan";

/** Extra $PIG questions per "boost-chat" purchase, valid for the day it was bought. */
export const CHAT_BOOST = 10;

export interface Usage {
  tier: Tier;
  used: number;
  limit: number; // Infinity when unlimited (Pro, for most kinds)
  left: number;
}

type Db = Pick<typeof prisma, "profile" | "coinTx">;

/** Today's usage of a daily allowance. Counters live in the coin ledger as zero-amount `use:<kind>` rows. */
export async function usage(userId: string, kind: LimitKind, db: Db = prisma): Promise<Usage> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { proUntil: true, liteUntil: true } });
  const tier = tierOf(profile);
  let limit = limitsFor(profile)[kind];
  if (limit === Infinity) return { tier, used: 0, limit, left: Infinity };
  const since = startOfUtcDay();
  const used = await db.coinTx.count({ where: { userId, reason: `use:${kind}`, createdAt: { gte: since } } });
  if (kind === "chat") {
    const [small, big] = await Promise.all([
      db.coinTx.count({ where: { userId, reason: "shop:boost-chat", createdAt: { gte: since } } }),
      db.coinTx.count({ where: { userId, reason: "shop:boost-chat-30", createdAt: { gte: since } } }),
    ]);
    limit += CHAT_BOOST * small + 30 * big;
  }
  return { tier, used, limit, left: Math.max(0, limit - used) };
}

/** Records one use; returns false when today's allowance is spent. Count and insert run under a per-user lock. */
export async function consumeAllowance(userId: string, kind: LimitKind): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `${userId}|${kind}`);
    const u = await usage(userId, kind, tx);
    if (u.limit === Infinity) return true;
    if (u.left <= 0) return false;
    await tx.coinTx.create({ data: { userId, amount: 0, reason: `use:${kind}` } });
    return true;
  });
}
