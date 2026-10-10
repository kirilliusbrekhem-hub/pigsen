import "server-only";
import { track } from "@/lib/analytics/track";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { creditStarsCoins, extendPro } from "@/lib/coins/service";
import { HttpError } from "@/lib/api/http";
import { COIN_PACKS, PLANS, isPlanId, type PackId, type PlanId } from "./plan";
import { setProTier } from "./tier";

// Telegram Stars payments through the PìgBiz bot. Token and webhook secret live only on the server.
const token = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
export const webhookSecret = () => process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";

export function starsEnabled(): boolean {
  return !!token() && !!webhookSecret();
}

async function tg<T>(method: string, body: object): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!data?.ok) throw new HttpError(502, `Telegram вернул ошибку (${data?.description ?? res.status}).`);
  return data.result as T;
}

/** Creates a Stars invoice link. Our payment id travels as the invoice payload. */
export async function createStarsInvoice(userId: string, planId: PlanId): Promise<{ url: string; id: string }> {
  if (!starsEnabled()) throw new HttpError(503, "Оплата пока не подключена. Попробуйте Pro за PigCoin$.");
  const plan = PLANS[planId];
  const id = `tg_${randomBytes(12).toString("hex")}`;
  await prisma.payment.create({ data: { id, userId, plan: plan.id, amount: plan.stars, provider: "telegram" } });
  const url = await tg<string>("createInvoiceLink", {
    title: `PìgBiz ${plan.title}`,
    description: "Безлимитный $PIG-коуч, разбор трат, все обложки целей и x2 PigCoin$.",
    payload: id,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: plan.title, amount: plan.stars }],
    // Monthly plan is a Telegram Stars subscription: Telegram charges again every 30 days until the user cancels.
    ...(plan.recurring ? { subscription_period: 2_592_000 } : {}),
  });
  return { url, id };
}

/** Stars invoice for a PigCoin$ pack. Pack id is validated by the caller; price and amount come from the server table. */
export async function createCoinsInvoice(userId: string, packId: PackId): Promise<{ url: string; id: string }> {
  if (!starsEnabled()) throw new HttpError(503, "Покупка PigCoin$ за звёзды скоро появится.");
  const pack = COIN_PACKS[packId];
  if (!pack) throw new HttpError(400, "Такого пакета нет");
  const id = `tgc_${randomBytes(12).toString("hex")}`;
  await prisma.payment.create({ data: { id, userId, plan: pack.id, amount: pack.stars, provider: "telegram" } });
  const url = await tg<string>("createInvoiceLink", {
    title: `${pack.coins} PigCoin$`,
    description: `${pack.coins} PigCoin$ на баланс PìgBiz для магазина. Бонусные баллы без денежной стоимости.`,
    payload: id,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: `${pack.coins} PigCoin$`, amount: pack.stars }],
  });
  return { url, id };
}

export function validSecret(header: string | null): boolean {
  const a = Buffer.from(header ?? "");
  const b = Buffer.from(webhookSecret());
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

interface Update {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string };
  message?: {
    chat: { id: number };
    text?: string;
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      is_recurring?: boolean;
      is_first_recurring?: boolean;
    };
  };
}

export async function handleUpdate(u: Update): Promise<void> {
  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    const p = await prisma.payment.findUnique({ where: { id: q.invoice_payload } });
    // A subscription's renewals reuse the original payload, so an already-paid monthly payment is still valid.
    const ok = !!p && (p.status === "pending" || (isPlanId(p.plan) && PLANS[p.plan].recurring)) && q.currency === "XTR" && q.total_amount === p.amount;
    await tg("answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "Счёт устарел. Нажмите «Оформить» на сайте ещё раз." });
    return;
  }
  const sp = u.message?.successful_payment;
  if (sp && u.message) {
    const p = await prisma.payment.findUnique({ where: { id: sp.invoice_payload } });
    if (!p || sp.currency !== "XTR" || sp.total_amount < p.amount) return;
    const pack = COIN_PACKS[p.plan as PackId];
    if (pack) {
      // Coin pack: claim + credit in one transaction, so a redelivered update pays once.
      if (!(await creditStarsCoins(p.id, sp.telegram_payment_charge_id, pack.coins))) return;
      await tg("sendMessage", { chat_id: u.message.chat.id, text: `Оплата прошла! +${pack.coins} PigCoin$ на вашем балансе PìgBiz. Вернитесь на сайт: страница обновится сама.` }).catch(() => {});
      return;
    }
    let fresh: boolean;
    if (sp.is_recurring && !sp.is_first_recurring) {
      // Monthly renewal: one row per Telegram charge, so a redelivered update can't extend Pro twice.
      fresh = await prisma.payment
        .create({ data: { id: `tgr_${sp.telegram_payment_charge_id}`.slice(0, 120), userId: p.userId, plan: p.plan, amount: sp.total_amount, status: "succeeded", applied: true, provider: "telegram", providerRef: sp.telegram_payment_charge_id } })
        .then(() => true, () => false);
    } else {
      // First payment: applied exactly once even if Telegram redelivers the update.
      const claimed = await prisma.payment.updateMany({ where: { id: p.id, applied: false }, data: { applied: true, status: "succeeded", providerRef: sp.telegram_payment_charge_id } });
      fresh = claimed.count > 0;
    }
    if (!fresh) return;
    const until = await extendPro(p.userId, PLANS[p.plan as PlanId]?.days ?? 30);
    await track("pro_purchase", p.userId, { plan: p.plan, amount: sp.total_amount, provider: "telegram" });
    if (isPlanId(p.plan)) await setProTier(p.userId, PLANS[p.plan].tier);
    await tg("sendMessage", { chat_id: u.message.chat.id, text: `Оплата прошла! PìgBiz Pro активен до ${until.toLocaleDateString("ru-RU")}.${isPlanId(p.plan) && PLANS[p.plan].recurring ? " Подписка продлевается каждый месяц, отменить можно в Telegram: Настройки → Мои звёзды." : ""} Вернитесь на сайт: страница обновится сама.` }).catch(() => {});
    return;
  }
  if (u.message?.text?.startsWith("/start")) {
    await tg("sendMessage", { chat_id: u.message.chat.id, text: "Привет! Я бот оплаты PìgBiz. Оформить Pro можно на сайте на странице «Pro и PigCoin$»." }).catch(() => {});
  }
}

/** Points the bot's webhook at this site. */
export async function registerWebhook(origin: string): Promise<void> {
  await tg("setWebhook", { url: `${origin}/api/telegram/webhook`, secret_token: webhookSecret(), allowed_updates: ["message", "pre_checkout_query"] });
}

export async function paymentStatus(userId: string, id: string): Promise<string | null> {
  const p = await prisma.payment.findFirst({ where: { id, userId }, select: { status: true } });
  return p?.status ?? null;
}
