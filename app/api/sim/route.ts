import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody } from "@/lib/api/http";
import { BIZ_KINDS } from "@/lib/sim/engine";
import { requireSimApiUser } from "@/lib/sim/gate";
import { activeRun, startRun } from "@/lib/sim/service";

const Body = z.object({ kind: z.enum(BIZ_KINDS) }).strict();

/** Current active run, if any. */
export const GET = handler(async () => {
  const user = await requireSimApiUser();
  await enforceDbRateLimit(`sim-get:${user.id}`, 60, 60_000);
  return json({ run: await activeRun(user.id) });
});

/** Starts a new run (Free: 1 per UTC day, Pro: unlimited). */
export const POST = handler(async (req: Request) => {
  const user = await requireSimApiUser();
  await enforceDbRateLimit(`sim-start:${user.id}`, 10, 10 * 60_000);
  const { kind } = await parseBody(req, Body);
  return json({ run: await startRun(user.id, kind, user.profile) }, 201);
});
