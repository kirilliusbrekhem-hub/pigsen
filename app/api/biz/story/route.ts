import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { getView } from "@/lib/biz/service";
import { claimStory } from "@/lib/biz/play";

/** Completes the current story chapter when its goal is met; rewards every member once per type+chapter. */
export const POST = handler(async () => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-story:${user.id}`, 20, 60_000);
  const r = await claimStory(user);
  return json({ ...r, view: await getView(user, { simulate: false }) });
});
