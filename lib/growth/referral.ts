import { track } from "@/lib/analytics/track";
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addCoins } from "@/lib/coins/service";
import { advisoryLock } from "@/lib/db/lock";

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
    await track("invite_accepted", inviteeId, { inviterId: inviter.id });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }
  await addCoins(inviteeId, REFERRAL.inviteeBonus, "referral-welcome");
  return true;
}

/**
 * Rewards the inviter exactly once, when the invitee is really active: a completed lesson, a finished
 * quiz with a non-zero score and an account at least 24h old. Called on lesson completion, quiz submit
 * and the daily bonus, so it eventually fires once all conditions hold.
 */
export async function activateReferral(inviteeId: string): Promise<void> {
  const ref = await prisma.referral.findUnique({ where: { inviteeId }, select: { id: true, inviterId: true, rewarded: true } });
  if (!ref || ref.rewarded) return;
  const invitee = await prisma.user.findUnique({ where: { id: inviteeId }, select: { createdAt: true } });
  if (!invitee || Date.now() - invitee.createdAt.getTime() < 24 * 3_600_000) return;
  const [lesson, quiz] = await Promise.all([
    prisma.progress.findFirst({ where: { userId: inviteeId, completedAt: { not: null } }, select: { id: true } }),
    prisma.quizAttempt.findFirst({ where: { userId: inviteeId, completedAt: { not: null }, score: { gt: 0 } }, select: { id: true } }),
  ]);
  if (!lesson || !quiz) return;
  const inviter = await prisma.user.findUnique({ where: { id: ref.inviterId }, select: { blocked: true } });
  const since = new Date(Date.now() - 30 * 86_400_000);
  // One transaction under a per-inviter lock: the 30-day cap and milestones can't be raced.
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, ref.inviterId);
    const r = await tx.referral.updateMany({ where: { id: ref.id, rewarded: false }, data: { rewarded: true } });
    if (!r.count || !inviter || inviter.blocked) return;
    // Anti-abuse cap: count rewards actually paid in the last 30 days (ledger is the source of truth).
    const paid30 = await tx.coinTx.count({ where: { userId: ref.inviterId, reason: "referral", createdAt: { gte: since } } });
    if (paid30 >= REFERRAL.maxRewardedPer30d) return;
    await tx.profile.upsert({ where: { userId: ref.inviterId }, update: { coins: { increment: REFERRAL.inviterCoins } }, create: { userId: ref.inviterId, coins: REFERRAL.inviterCoins } });
    await tx.coinTx.create({ data: { userId: ref.inviterId, amount: REFERRAL.inviterCoins, reason: "referral" } });
    const totalPaid = await tx.coinTx.count({ where: { userId: ref.inviterId, reason: "referral" } });
    const milestone = totalPaid % REFERRAL.milestoneEvery === 0;
    const days = REFERRAL.inviterProDays + (milestone ? REFERRAL.milestoneProDays : 0);
    const p = await tx.profile.findUniqueOrThrow({ where: { userId: ref.inviterId }, select: { proUntil: true } });
    const base = p.proUntil && p.proUntil.getTime() > Date.now() ? p.proUntil : new Date();
    await tx.profile.update({ where: { userId: ref.inviterId }, data: { proUntil: new Date(base.getTime() + days * 86_400_000), plan: "pro" } });
    if (milestone) await tx.coinTx.create({ data: { userId: ref.inviterId, amount: 0, reason: "referral-milestone" } });
  });
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
