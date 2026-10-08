import { handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { rematch } from "@/lib/duels/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:create:${user.id}`, 10, 60_000);
  const { id } = await params;
  return json(await rematch(user, id.slice(0, 40)));
});
