import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { setCosmetic, setTitle } from "@/lib/coins/service";

const Body = z.union([
  z.object({ slot: z.enum(["bg", "emblem", "name", "ring"]), value: z.string().max(20) }),
  z.object({ slot: z.literal("title"), value: z.string().max(40) }),
]);

/** Profile customization: every choice is checked on the server (free, Pro or bought in the shop). */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`cosmetics:${user.id}`, 40, 60_000);
  const body = await parseBody(req, Body);
  if (body.slot === "title") await setTitle(user.id, body.value || null);
  else await setCosmetic(user.id, body.slot, body.value);
  return json({ ok: true });
});
