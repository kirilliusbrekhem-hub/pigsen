import { clientIp, enforceRateLimit, handler, json } from "@/lib/api/http";
import { syncPayment } from "@/lib/billing/yookassa";

// YooKassa notification. The body is only a hint: syncPayment re-reads the payment from the API with our secret key.
export const POST = handler(async (req: Request) => {
  enforceRateLimit(`yk:${clientIp(req)}`, 60, 60_000);
  const body = (await req.json().catch(() => null)) as { object?: { id?: unknown } } | null;
  const id = body?.object?.id;
  if (typeof id === "string" && /^[\w-]{10,60}$/.test(id)) await syncPayment(id);
  return json({ ok: true });
});
