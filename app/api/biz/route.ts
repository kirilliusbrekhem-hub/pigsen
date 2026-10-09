import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { sanitizeText } from "@/lib/validation/schemas";
import { BIZ_KIND_IDS } from "@/lib/biz/engine";
import { createBusiness, getView } from "@/lib/biz/service";

const Body = z.object({ kind: z.enum(BIZ_KIND_IDS), name: z.string().trim().min(2, "Минимум 2 символа").max(40, "До 40 символов") }).strict();

/** The user's business (simulates missed days on read). Polled by the team page. */
export const GET = handler(async () => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-get:${user.id}`, 90, 60_000);
  return json({ view: await getView(user) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-create:${user.id}`, 5, 10 * 60_000);
  const b = await parseBody(req, Body);
  await createBusiness(user, b.kind, sanitizeText(b.name));
  return json({ view: await getView(user, { simulate: false }) }, 201);
});
