import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type EventName =
  | "signup"
  | "login"
  | "deposit"
  | "first_deposit"
  | "pro_purchase"
  | "invite_accepted"
  | "pig_message"
  | `biz_${string}`;

/** Fire-and-forget-safe event tracking: never throws, so analytics can't break a user action. */
export async function track(name: EventName, userId?: string | null, props: Record<string, unknown> = {}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({ data: { name, userId: userId ?? null, props: props as Prisma.InputJsonValue } });
  } catch (e) {
    console.error("[analytics] track failed", name, e);
  }
}
