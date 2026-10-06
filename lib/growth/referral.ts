import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addCoins, extendPro } from "@/lib/coins/service";

export const REFERRAL = {
  inviteeBonus: 200,
  inviterCoins: 500,
  inviterProDays: 7,
  milestoneEvery: 5,
  milestoneProDays: 30,
  maxRewardedPer30d: 20,
} as const;

export const REF_COOKIE = "pigsen_ref";

/** Links a fresh account to its inviter and pays the welcome bonus. Silently ignores bad refs. */
export async function attachReferral(inviteeId: string, ref: string | null | undefined): Promise<boolean> {
  if (!ref || ref === inviteeId || !/^[a-z0-9]{10,40}$/i.test(ref)) return false;
  const inviter = await prisma.user.findUnique({ where: { id: ref }, select: { id: true, blocked: true } });
  if (!inviter || inviter.blocked) return false;
  try {
    await prisma.referral.create({ data: { inviterId: inviter.id, inviteeId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }
  await addCoins(inviteeId, REFERRAL.inviteeBonus, "referral-welcome");
  return true;
}

/** Called on the invitee's first completed lesson: rewards the inviter exactly once. */
export async function activateReferral(inviteeId: string): Promise<void> {
  const ref = await prisma.referral.findUnique({ where: { inviteeId }, select: { id: true, inviterId: true, rewarded: true } });
  if (!ref || ref.rewarded) return;
  const inviter = await prisma.user.findUnique({ where: { id: ref.inviterId }, select: { blocked: true } });
  const since = new Date(Date.now() - 30 * 86_400_000);
  // Mark first so concurrent calls can't pay twice.
  const r = await prisma.referral.updateMany({ where: { id: ref.id, rewarded: false }, data: { rewarded: true } });
  if (!r.count || !inviter || inviter.blocked) return;
  // Anti-abuse cap: count rewards actually paid in the last 30 days (ledger is the source of truth).
  const paid30 = await prisma.coinTx.count({ where: { userId: ref.inviterId, reason: "referral", createdAt: { gte: since } } });
  if (paid30 >= REFERRAL.maxRewardedPer30d) return;
  await addCoins(ref.inviterId, REFERRAL.inviterCoins, "referral");
  await extendPro(ref.inviterId, REFERRAL.inviterProDays);
  const totalPaid = await prisma.coinTx.count({ where: { userId: ref.inviterId, reason: "referral" } });
  if (totalPaid % REFERRAL.milestoneEvery === 0) {
    await extendPro(ref.inviterId, REFERRAL.milestoneProDays);
    await prisma.coinTx.create({ data: { userId: ref.inviterId, amount: 0, reason: "referral-milestone" } });
  }
}

export async function referralStats(userId: string) {
  const [invited, activated, txs] = await Promise.all([
    prisma.referral.count({ where: { inviterId: userId } }),
    prisma.referral.count({ where: { inviterId: userId, rewarded: true } }),
    prisma.coinTx.findMany({ where: { userId, reason: { in: ["referral", "referral-milestone"] } }, select: { reason: true } }),
  ]);
  const paid = txs.filter((t) => t.reason === "referral").length;
  const milestones = txs.length - paid;
  return {
    invited,
    activated,
    coins: paid * REFERRAL.inviterCoins,
    proDays: paid * REFERRAL.inviterProDays + milestones * REFERRAL.milestoneProDays,
    toNextMilestone: REFERRAL.milestoneEvery - (paid % REFERRAL.milestoneEvery),
  };
}
