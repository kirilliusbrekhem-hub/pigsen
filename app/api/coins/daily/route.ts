import { handler, json, requireApiUser } from "@/lib/api/http";
import { claimDailyBonus } from "@/lib/coins/service";
import { activateReferral } from "@/lib/growth/referral";
import { getGameStats } from "@/lib/gamification/service";

/** Pays today's login bonus once; later calls return 0. A POST, so link prefetching can't claim it. */
export const POST = handler(async () => {
  const user = await requireApiUser();
  const { streak } = await getGameStats(user.id);
  const bonus = await claimDailyBonus(user.id, streak);
  // A pending referral may become eligible a day after sign-up: retry activation on daily visits.
  await activateReferral(user.id).catch((e) => console.error("[referral] activate failed", e));
  return json({ bonus });
});
