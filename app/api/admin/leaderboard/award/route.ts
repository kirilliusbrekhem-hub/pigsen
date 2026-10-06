import { handler, json } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { awardLastWeek } from "@/lib/social/leaderboard";

export const POST = handler(async () => {
  await requireApiAdmin();
  return json(await awardLastWeek());
});
