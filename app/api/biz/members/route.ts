import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { getView, kickMember, transferFounder } from "@/lib/biz/service";

const Body = z.object({ action: z.enum(["kick", "transfer"]), userId: z.string().min(1).max(40) }).strict();

/** Founder-only team management; the service checks that the target is in the founder's own business. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-members:${user.id}`, 20, 10 * 60_000);
  const b = await parseBody(req, Body);
  if (b.action === "kick") await kickMember(user.id, b.userId);
  else await transferFounder(user.id, b.userId);
  return json({ view: await getView(user, { simulate: false }) });
});
