import { z } from "zod";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { parseLimited } from "@/lib/bizplan/body";
import { STEPS } from "@/lib/bizplan/schema";
import { stepHint } from "@/lib/bizplan/text";
import { sanitizeText } from "@/lib/validation/schemas";

const Body = z.object({
  step: z.enum(STEPS.map((s) => s.id) as [string, ...string[]]),
  title: z.string().max(80).optional(),
  idea: z.string().max(1500).optional(),
  audience: z.string().max(800).optional(),
  price: z.number().finite().min(0).max(1e9).optional(),
  unitCost: z.number().finite().min(0).max(1e9).optional(),
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`bizplan:hint:${user.id}`, 20, 10 * 60_000);
  const b = await parseLimited(req, Body);
  const s = (v?: string) => (v ? sanitizeText(v) : undefined);
  return json(await stepHint(b.step as (typeof STEPS)[number]["id"], { title: s(b.title), idea: s(b.idea), audience: s(b.audience), price: b.price, unitCost: b.unitCost }));
});
