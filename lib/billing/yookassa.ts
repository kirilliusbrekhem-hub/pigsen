import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { extendPro } from "@/lib/coins/service";
import { HttpError } from "@/lib/api/http";
import { PLANS, isPlanId, type PlanId } from "./plan";
import { setProTier } from "./tier";

// YooKassa (ЮKassa) payments over REST. Keys live only on the server: YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY.
const API = "https://api.yookassa.ru/v3/payments";

export function paymentsEnabled(): boolean {
  return !!process.env.YOOKASSA_SHOP_ID?.trim() && !!process.env.YOOKASSA_SECRET_KEY?.trim();
}

function auth(): string {
  return "Basic " + Buffer.from(`${process.env.YOOKASSA_SHOP_ID!.trim()}:${process.env.YOOKASSA_SECRET_KEY!.trim()}`).toString("base64");
}

interface YkPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { confirmation_url?: string };
  metadata?: Record<string, string>;
}

export async function createCheckout(userId: string, email: string, planId: PlanId, origin: string): Promise<string> {
  if (!paymentsEnabled()) throw new HttpError(503, "Оплата пока не подключена. Попробуйте Pro за PigCoin$.");
  const plan = PLANS[planId];
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth(), "idempotence-key": randomUUID() },
    body: JSON.stringify({
      amount: { value: plan.price.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: `${origin}/pro?paid=1` },
      description: `PìgBiz ${plan.title}`,
      metadata: { userId, plan: plan.id },
      // Fiscal receipt (54-FZ) only when the shop has receipts enabled: YOOKASSA_RECEIPTS=1.
      ...(process.env.YOOKASSA_RECEIPTS === "1" ? { receipt: {
        customer: { email },
        items: [{ description: `PìgBiz ${plan.title}`, quantity: "1.00", amount: { value: plan.price.toFixed(2), currency: "RUB" }, vat_code: 1, payment_mode: "full_payment", payment_subject: "service" }],
      } } : {}),
    }),
  });
  const data = (await res.json().catch(() => null)) as (YkPayment & { description?: string }) | null;
  if (!res.ok || !data?.confirmation?.confirmation_url) {
    console.error("[billing] create failed", res.status, data);
    throw new HttpError(502, `Платёжный сервис вернул ошибку (${res.status}${data?.description ? `: ${data.description}` : ""}).`);
  }
  await prisma.payment.create({ data: { id: data.id, userId, plan: plan.id, amount: plan.price } });
  return data.confirmation.confirmation_url;
}

/** Re-reads the payment from YooKassa (never trusts the webhook body) and grants Pro exactly once. */
export async function syncPayment(id: string): Promise<"succeeded" | "pending" | "canceled" | "unknown"> {
  if (!paymentsEnabled()) return "unknown";
  const local = await prisma.payment.findUnique({ where: { id } });
  if (!local) return "unknown";
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, { headers: { authorization: auth() } });
  if (!res.ok) return "unknown";
  const p = (await res.json()) as YkPayment;
  if (p.status === "succeeded" && p.paid && p.amount.currency === "RUB" && Number(p.amount.value) >= local.amount) {
    const claimed = await prisma.payment.updateMany({ where: { id, applied: false }, data: { applied: true, status: "succeeded" } });
    if (claimed.count) {
      await extendPro(local.userId, PLANS[local.plan as PlanId]?.days ?? 30);
      if (isPlanId(local.plan)) await setProTier(local.userId, PLANS[local.plan].tier);
    }
    return "succeeded";
  }
  if (p.status === "canceled") {
    await prisma.payment.update({ where: { id }, data: { status: "canceled" } });
    return "canceled";
  }
  return "pending";
}

/** After returning from checkout: sync the user's recent pending payments. */
export async function syncRecentPayments(userId: string): Promise<boolean> {
  const pending = await prisma.payment.findMany({ where: { userId, provider: "yookassa", status: "pending", createdAt: { gte: new Date(Date.now() - 86_400_000) } }, take: 3 });
  let ok = false;
  for (const p of pending) if ((await syncPayment(p.id)) === "succeeded") ok = true;
  return ok;
}
