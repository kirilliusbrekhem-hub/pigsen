import { z } from "zod";
import { HttpError, enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { buyItem } from "@/lib/coins/service";

const Body = z.object({ itemId: z.string().min(1).max(40) });

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`shop:${user.id}`, 10, 60_000);
  const { itemId } = await parseBody(req, Body);
  const r = await buyItem(user.id, itemId);
  if (!r.ok) throw new HttpError(r.error === "Не хватает PigCoin$" ? 402 : 409, r.error);
  return json(r);
});
