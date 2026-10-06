import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isPro } from "@/lib/billing/plan";
import { HttpError } from "@/lib/api/http";

/** PigCoin$: earned for learning and saving, spent in the shop. Every change goes through the CoinTx ledger. */
export const COINS = {
  dailyDeposit: 5,
  milestone: 25,
  resistedSpend: 10,
} as const;

export async function addCoins(userId: string, amount: number, reason: string): Promise<number> {
  if (amount <= 0) return 0;
  await prisma.$transaction([
    prisma.profile.upsert({ where: { userId }, update: { coins: { increment: amount } }, create: { userId, coins: amount } }),
    prisma.coinTx.create({ data: { userId, amount, reason } }),
  ]);
  return amount;
}

/** Pays a reward at most once per UTC day for a given reason prefix. */
export async function addDailyCoins(userId: string, amount: number, reason: string): Promise<number> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
  const value = isPro(profile) && reason === "deposit" ? amount * 2 : amount;
  const dayKey = `${reason}:${new Date().toISOString().slice(0, 10)}`;
  try {
    await prisma.$transaction([
      prisma.dailyClaim.create({ data: { userId, key: dayKey } }),
      prisma.coinTx.create({ data: { userId, amount: value, reason } }),
      prisma.profile.update({ where: { userId }, data: { coins: { increment: value } } }),
    ]);
    return value;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return 0; // already paid today
    throw e;
  }
}

/** Atomically spends coins; returns false if the balance is too low. */
export async function spendCoins(userId: string, amount: number, reason: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.profile.updateMany({ where: { userId, coins: { gte: amount } }, data: { coins: { decrement: amount } } });
    if (r.count === 0) return false;
    await tx.coinTx.create({ data: { userId, amount: -amount, reason } });
    return true;
  });
}

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: string;
  /** Repeatable items (Pro days) are not recorded as owned. */
  repeatable?: boolean;
}

export const SHOP: ShopItem[] = [
  { id: "pro-3d", title: "Pro на 3 дня", description: "Все возможности Pro без оплаты деньгами", price: 400, icon: "sparkle", repeatable: true },
  { id: "theme-car", title: "Обложка «Машина»", description: "Для цели на автомобиль", price: 120, icon: "car" },
  { id: "theme-rocket", title: "Обложка «Свой бизнес»", description: "Для стартового капитала", price: 120, icon: "rocket" },
  { id: "theme-heart", title: "Обложка «Для близких»", description: "Подарки, свадьба, семья", price: 120, icon: "heart" },
  { id: "theme-cap", title: "Обложка «Учёба»", description: "Курсы, вуз, обучение", price: 120, icon: "cap" },
  { id: "theme-gold", title: "Золотая обложка", description: "Для самой большой мечты", price: 250, icon: "coin" },
];

export async function buyItem(userId: string, itemId: string): Promise<{ ok: true; coins: number } | { ok: false; error: string }> {
  const item = SHOP.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Такого товара нет" };
  if (!item.repeatable) {
    const owned = await prisma.purchase.findUnique({ where: { userId_itemId: { userId, itemId } } });
    if (owned) return { ok: false, error: "Уже куплено" };
  }
  if (item.repeatable) {
    if (!(await spendCoins(userId, item.price, `shop:${item.id}`))) return { ok: false, error: "Не хватает PigCoin$" };
    await extendPro(userId, 3);
  } else {
    // Spend and record ownership in one transaction: a double click can't charge twice.
    try {
      const ok = await prisma.$transaction(async (tx) => {
        await tx.purchase.create({ data: { userId, itemId } });
        const r = await tx.profile.updateMany({ where: { userId, coins: { gte: item.price } }, data: { coins: { decrement: item.price } } });
        if (!r.count) throw new HttpError(402, "Не хватает PigCoin$");
        await tx.coinTx.create({ data: { userId, amount: -item.price, reason: `shop:${item.id}` } });
        return true;
      });
      if (!ok) return { ok: false, error: "Не хватает PigCoin$" };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: "Уже куплено" };
      if (e instanceof HttpError) return { ok: false, error: e.message };
      throw e;
    }
  }
  const p = await prisma.profile.findUnique({ where: { userId }, select: { coins: true } });
  return { ok: true, coins: p?.coins ?? 0 };
}

export async function extendPro(userId: string, days: number): Promise<Date> {
  const p = await prisma.profile.upsert({ where: { userId }, update: {}, create: { userId }, select: { proUntil: true } });
  const base = p.proUntil && p.proUntil.getTime() > Date.now() ? p.proUntil : new Date();
  const until = new Date(base.getTime() + days * 86_400_000);
  await prisma.profile.update({ where: { userId }, data: { proUntil: until, plan: "pro" } });
  return until;
}

export async function ownedItems(userId: string): Promise<Set<string>> {
  const rows = await prisma.purchase.findMany({ where: { userId }, select: { itemId: true } });
  return new Set(rows.map((r) => r.itemId));
}
