import { z } from "zod";
import { HttpError, enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { vapidPublicKey } from "@/lib/push/config";

/** Known browser push services; anything else would turn our server into a request proxy. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/, /^web\.push\.apple\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/];
const allowedEndpoint = (u: string) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
};

const Sub = z.object({
  endpoint: z.string().url().max(1000).refine(allowedEndpoint, "Неизвестный push-сервис"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`push:${user.id}`, 10, 60_000);
  if (!vapidPublicKey()) throw new HttpError(503, "Уведомления пока не настроены");
  const b = await parseBody(req, Sub);
  if ((await prisma.pushSub.count({ where: { userId: user.id } })) >= 10) {
    const oldest = await prisma.pushSub.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (oldest) await prisma.pushSub.delete({ where: { id: oldest.id } });
  }
  await prisma.pushSub.upsert({
    where: { endpoint: b.endpoint },
    create: { userId: user.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
    update: { userId: user.id, p256dh: b.keys.p256dh, auth: b.keys.auth },
  });
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`push:${user.id}`, 10, 60_000);
  const b = await parseBody(req, z.object({ endpoint: z.string().max(1000) }));
  await prisma.pushSub.deleteMany({ where: { userId: user.id, endpoint: b.endpoint } });
  return json({ ok: true });
});
