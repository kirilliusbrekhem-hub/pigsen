import { z } from "zod";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { parseLimited } from "@/lib/bizplan/body";
import { PlanInputSchema } from "@/lib/bizplan/schema";
import { createPlan, listPlans } from "@/lib/bizplan/service";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ plans: await listPlans(user.id) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`bizplan:write:${user.id}`, 10, 10 * 60_000);
  const { input } = await parseLimited(req, z.object({ input: PlanInputSchema }));
  const plan = await createPlan(user, input);
  return json({ id: plan.id, demo: plan.demo }, 201);
});
