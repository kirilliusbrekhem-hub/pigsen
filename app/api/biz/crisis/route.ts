import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { getView } from "@/lib/biz/service";
import { resolveCrisis } from "@/lib/biz/play";

const Body = z.object({ crisisId: z.string().regex(/^[a-z]{1,24}$/), optionId: z.string().regex(/^[a-z]{1,24}$/) }).strict();

/** Any member picks a crisis response; the outcome is computed server-side and deterministic. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-crisis:${user.id}`, 20, 60_000);
  const b = await parseBody(req, Body);
  const outcome = await resolveCrisis(user, b.crisisId, b.optionId);
  return json({ outcome, view: await getView(user, { simulate: false }) });
});
