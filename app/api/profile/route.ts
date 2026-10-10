import { prisma } from "@/lib/db/prisma";
import { endSession } from "@/lib/auth/session";
import { handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { parseInterests, updateProfile } from "@/lib/profile/service";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { leaveBusiness } from "@/lib/biz/service";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile ? { ...user.profile, interests: parseInterests(user.profile) } : null,
  });
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireApiUser();
  const patch = await parseBody(req, profileUpdateSchema);
  await updateProfile(user.id, patch);
  return json({ ok: true });
});

/** Deletes the account and all related data (cascade). */
export const DELETE = handler(async () => {
  const user = await requireApiUser();
  // The last admin can't delete themselves: the panel would be left without an owner.
  if (await prisma.adminGrant.findUnique({ where: { userId: user.id } })) {
    if ((await prisma.adminGrant.count()) <= 1) throw new HttpError(409, "Вы единственный администратор. Сначала выдайте права другому аккаунту.");
  }
  // These tables keep a plain userId (no relation), so clear them alongside the user.
  await leaveBusiness(user.id); // «Мой бизнес»: hand the team to another member or close a solo business
  await prisma.$transaction([
    prisma.bizMember.deleteMany({ where: { userId: user.id } }),
    prisma.bizChat.deleteMany({ where: { userId: user.id } }),
    prisma.bizEvent.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.bizPlan.deleteMany({ where: { userId: user.id } }),
    prisma.duel.deleteMany({ where: { creatorId: user.id } }), // players + answers cascade
    prisma.duelPlayer.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.spendAnalysis.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  await endSession();
  return json({ ok: true });
});
