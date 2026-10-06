import { handler, json, requireApiUser } from "@/lib/api/http";
import { referralStats } from "@/lib/growth/referral";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ inviteId: user.id, ...(await referralStats(user.id)) });
});
