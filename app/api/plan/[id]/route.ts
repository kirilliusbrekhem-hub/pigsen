import { z } from "zod";
import { HttpError, handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { parseLimited } from "@/lib/bizplan/body";
import { PlanInputSchema } from "@/lib/bizplan/schema";
import { deletePlan, getPlan, updatePlan } from "@/lib/bizplan/service";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);

async function planId(ctx: Ctx) {
  const r = Id.safeParse((await ctx.params).id);
  if (!r.success) throw new HttpError(404, "План не найден");
  return r.data;
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const plan = await getPlan(user.id, await planId(ctx));
  if (!plan) throw new HttpError(404, "План не найден");
  return json(plan);
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const id = await planId(ctx);
  await enforceDbRateLimit(`bizplan:write:${user.id}`, 10, 10 * 60_000);
  const { input } = await parseLimited(req, z.object({ input: PlanInputSchema }));
  const plan = await updatePlan(user.id, id, input);
  return json({ id: plan.id, demo: plan.demo });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  await deletePlan(user.id, await planId(ctx));
  return json({ ok: true });
});
