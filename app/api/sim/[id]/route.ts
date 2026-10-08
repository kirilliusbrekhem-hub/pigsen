import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { HttpError, handler, json } from "@/lib/api/http";
import { requireSimApiUser } from "@/lib/sim/gate";
import { getRun } from "@/lib/sim/service";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireSimApiUser();
  await enforceDbRateLimit(`sim-get:${user.id}`, 60, 60_000);
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new HttpError(404, "Игра не найдена");
  const run = await getRun(user.id, id);
  if (!run) throw new HttpError(404, "Игра не найдена");
  return json({ run });
});
