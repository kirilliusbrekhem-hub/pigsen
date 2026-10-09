import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { ProTier } from "./plan";

/**
 * Records the tier of the plan just paid. Upgrading mid-period simply switches the tier now (days add up via
 * extendPro); a downgrade lowers the team cap, existing «Мой бизнес» members stay but new joins wait until the team fits.
 */
export async function setProTier(userId: string, tier: ProTier): Promise<void> {
  await prisma.profile.update({ where: { userId }, data: { proTier: tier } });
}
