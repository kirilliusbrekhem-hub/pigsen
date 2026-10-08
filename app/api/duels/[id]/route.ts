import { handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { duelState } from "@/lib/duels/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:state:${user.id}`, 120, 60_000);
  const { id } = await params;
  return json(await duelState(user.id, id.slice(0, 40)));
});
