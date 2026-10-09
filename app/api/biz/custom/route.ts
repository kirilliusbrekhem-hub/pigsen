import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { getView } from "@/lib/biz/service";
import { updateCustom } from "@/lib/biz/play";
import { CustomBody } from "../_custom";

/** Pro + founder: logo emoji, green accent and custom item names. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-custom:${user.id}`, 20, 10 * 60_000);
  const b = await parseBody(req, CustomBody);
  await updateCustom(user, b);
  return json({ view: await getView(user, { simulate: false }) });
});
