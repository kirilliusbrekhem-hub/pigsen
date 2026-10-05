import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { createCheckout } from "@/lib/billing/yookassa";
import { createStarsInvoice, starsEnabled } from "@/lib/billing/telegram";

const Body = z.object({ plan: z.enum(["month", "year"]) });

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`checkout:${user.id}`, 5, 60_000);
  const { plan } = await parseBody(req, Body);
  // Telegram Stars when the bot is configured, otherwise YooKassa.
  if (starsEnabled()) return json({ ...(await createStarsInvoice(user.id, plan)), telegram: true });
  const origin = new URL(req.url).origin;
  return json({ url: await createCheckout(user.id, user.email, plan, origin) });
});
