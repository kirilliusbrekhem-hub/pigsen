import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { claimChallenge } from "@/lib/biz/challenges";
import { getView } from "@/lib/biz/service";

const Body = z.object({ id: z.string().regex(/^[a-z]{1,24}$/) }).strict();

/** Completes a savings challenge (progress = the member's real net deposits this week). */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-ch:${user.id}`, 20, 60_000);
  const { id } = await parseBody(req, Body);
  const coins = await claimChallenge(user.id, id);
  return json({ coins, view: await getView(user, { simulate: false }) });
});
