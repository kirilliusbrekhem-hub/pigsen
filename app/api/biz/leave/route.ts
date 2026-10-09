import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { leaveBusiness } from "@/lib/biz/service";

export const POST = handler(async () => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-leave:${user.id}`, 10, 10 * 60_000);
  await leaveBusiness(user.id);
  return json({ ok: true });
});
