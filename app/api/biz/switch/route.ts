import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { sanitizeText } from "@/lib/validation/schemas";
import { BIZ_KIND_IDS } from "@/lib/biz/catalog";
import { cleanName, getView } from "@/lib/biz/service";
import { switchBusiness } from "@/lib/biz/play";
import { CustomBody } from "../_custom";

const Body = z.object({ kind: z.enum(BIZ_KIND_IDS), name: z.string().trim().min(2, "Минимум 2 символа").max(40, "До 40 символов"), custom: CustomBody.nullable().optional() }).strict();

/** Founder only: start a new business type for the team. Capital (mirrored savings) is kept, upgrades reset. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-switch:${user.id}`, 5, 10 * 60_000);
  const b = await parseBody(req, Body);
  await switchBusiness(user, b.kind, cleanName(sanitizeText(b.name)), b.custom ?? null);
  return json({ view: await getView(user, { simulate: false }) });
});
