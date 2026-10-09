import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { joinBusiness } from "@/lib/biz/service";

const Body = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{8,32}$/, "Неверный код") }).strict();

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-join:${user.id}`, 10, 10 * 60_000);
  const { code } = await parseBody(req, Body);
  await joinBusiness(user, code);
  return json({ ok: true });
});
