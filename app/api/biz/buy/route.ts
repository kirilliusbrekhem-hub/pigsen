import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { buyUpgrade, getView, repairUpgrade } from "@/lib/biz/service";

const Body = z.object({ itemId: z.string().max(40).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), repair: z.boolean().default(false) }).strict();

/** Spends business capital (mirrored savings) on an upgrade or a repair. Race-safe under an advisory lock. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-buy:${user.id}`, 30, 60_000);
  const b = await parseBody(req, Body);
  const r = b.repair ? await repairUpgrade(user, b.itemId) : await buyUpgrade(user, b.itemId);
  return json({ ...r, view: await getView(user, { simulate: false }) });
});
