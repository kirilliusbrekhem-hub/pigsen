import { handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { currentQuestion } from "@/lib/duels/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST: serving a question starts its clock, so it must not be prefetchable. */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:q:${user.id}`, 60, 60_000);
  const { id } = await params;
  return json(await currentQuestion(user.id, id.slice(0, 40)));
});
