import { z } from "zod";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { submitAnswer } from "@/lib/duels/service";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ index: z.number().int().min(0).max(6), choice: z.number().int().min(-1).max(3) });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:a:${user.id}`, 60, 60_000);
  const { id } = await params;
  const { index, choice } = await parseBody(req, Body);
  return json(await submitAnswer(user.id, id.slice(0, 40), index, choice));
});
