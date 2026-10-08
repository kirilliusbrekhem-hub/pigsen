import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { PACK_IDS } from "@/lib/billing/plan";
import { createCoinsInvoice } from "@/lib/billing/telegram";

const Body = z.object({ pack: z.enum(PACK_IDS) });

/** Telegram Stars invoice for a PigCoin$ pack. Status is polled via /api/billing/status. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`checkout:${user.id}`, 5, 60_000);
  const { pack } = await parseBody(req, Body);
  return json({ ...(await createCoinsInvoice(user.id, pack)), telegram: true });
});
