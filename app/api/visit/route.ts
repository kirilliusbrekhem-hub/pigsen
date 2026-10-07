import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { clientIp, enforceRateLimit, handler, json, parseBody } from "@/lib/api/http";

// Public endpoint (anonymous landing visits). Same-origin is enforced in proxy.ts.
const str = (n: number) => z.string().max(2000).optional().transform((v) => (v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n));
const schema = z.object({
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  path: str(200),
  source: str(64),
  campaign: str(100),
});

export const POST = handler(async (req: Request) => {
  enforceRateLimit(`visit:${clientIp(req)}`, 30, 60 * 60_000);
  const { visitorId, path, source, campaign } = await parseBody(req, schema);
  const day = new Date().toISOString().slice(0, 10);
  await prisma.visit.upsert({
    where: { visitorId_day: { visitorId, day } },
    update: {},
    create: { visitorId, day, path, source: source.toLowerCase(), campaign },
  });
  return json({ ok: true });
});
