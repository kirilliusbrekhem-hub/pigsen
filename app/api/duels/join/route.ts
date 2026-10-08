import { z } from "zod";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { joinFriendDuel } from "@/lib/duels/service";

const Body = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{4,32}$/) });

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`duels:join:${user.id}`, 10, 60_000);
  const { code } = await parseBody(req, Body);
  return json(await joinFriendDuel(user, code));
});
