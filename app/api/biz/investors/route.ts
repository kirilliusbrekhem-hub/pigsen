import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { getView } from "@/lib/biz/service";
import { dealAction } from "@/lib/biz/play";

const Body = z.object({ investorId: z.string().regex(/^[a-z]{1,24}$/), action: z.enum(["accept", "decline"]) }).strict();

/** Founder accepts or declines an investor's deal. Deals never add capital: they require real savings discipline. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-inv:${user.id}`, 20, 60_000);
  const b = await parseBody(req, Body);
  await dealAction(user, b.investorId, b.action);
  return json({ view: await getView(user, { simulate: false }) });
});
