import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { vapidPublicKey } from "@/lib/push/config";
import { sendPushToUser } from "@/lib/push/send";
import { buildReminder } from "@/lib/savings/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daily (Vercel cron, 09:00 UTC): one motivational push per subscribed user with active goals. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!vapidPublicKey()) return Response.json({ ok: true, skipped: "VAPID keys are not set" });
  const users = await prisma.pushSub.findMany({ where: { user: { savingsGoals: { some: {} } } }, distinct: ["userId"], select: { userId: true } });
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < users.length; i += 20) {
    await Promise.all(
      users.slice(i, i + 20).map(async ({ userId }) => {
        try {
          const p = await buildReminder(userId);
          if (p && (await sendPushToUser(userId, p))) sent++;
        } catch (err) {
          failed++;
          console.error("[cron/push]", err);
        }
      }),
    );
  }
  return Response.json({ ok: true, users: users.length, sent, failed });
}
