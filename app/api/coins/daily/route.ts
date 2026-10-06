import { handler, json, requireApiUser } from "@/lib/api/http";
import { claimDailyBonus } from "@/lib/coins/service";
import { getGameStats } from "@/lib/gamification/service";

/** Pays today's login bonus once; later calls return 0. A POST, so link prefetching can't claim it. */
export const POST = handler(async () => {
  const user = await requireApiUser();
  const { streak } = await getGameStats(user.id);
  return json({ bonus: await claimDailyBonus(user.id, streak) });
});
