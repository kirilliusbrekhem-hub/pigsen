import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { askAdvice, getView } from "@/lib/biz/service";

/** Honest numbers-based tip from $PIG: Free 1/day, Pro 3/day. */
export const POST = handler(async () => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-advice:${user.id}`, 10, 60_000);
  await askAdvice(user);
  return json({ view: await getView(user, { simulate: false }) });
});
