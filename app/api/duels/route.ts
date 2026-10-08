import { z } from "zod";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { createDuel, lobby } from "@/lib/duels/service";

const Body = z.object({ mode: z.enum(["friend", "random"]), stake: z.union([z.literal(0), z.literal(10), z.literal(50), z.literal(100)]) });

export const GET = handler(async () => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:get:${user.id}`, 120, 60_000);
  return json(await lobby(user.id));
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:create:${user.id}`, 10, 60_000);
  const { mode, stake } = await parseBody(req, Body);
  return json(await createDuel(user, mode, stake), 201);
});
