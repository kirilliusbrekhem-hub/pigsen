import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db/prisma";
import { vapidPublicKey } from "./config";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  image?: string;
  tag?: string;
}

let configured = false;
function setup(): boolean {
  const pub = vapidPublicKey();
  if (!pub) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

/** Sends a push to every device of the user. Dead subscriptions (404/410) are removed. Returns delivered count. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!setup()) return 0;
  const subs = await prisma.pushSub.findMany({ where: { userId } });
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 12 * 3600 });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSub.deleteMany({ where: { id: s.id } });
        else console.error("[push] send failed", code ?? err);
      }
    }),
  );
  return sent;
}
