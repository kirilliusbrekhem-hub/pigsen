import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { equipItem } from "@/lib/coins/service";

const Body = z.object({ itemId: z.string().min(1).max(40), off: z.boolean().optional() });

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`equip:${user.id}`, 20, 60_000);
  const { itemId, off } = await parseBody(req, Body);
  await equipItem(user.id, itemId, off);
  return json({ ok: true });
});
