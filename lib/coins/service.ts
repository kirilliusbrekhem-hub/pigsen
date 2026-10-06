import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isPro, startOfUtcDay } from "@/lib/billing/plan";
import { HttpError } from "@/lib/api/http";

/** PigCoin$: earned for learning and saving, spent in the shop. Every change goes through the CoinTx ledger. */
export const COINS = {
  dailyDeposit: 15,
  milestone: 50,
  resistedSpend: 20,
  /** Daily login bonus: base + per streak day, capped; Pro adds proDaily on top. */
  dailyBase: 10,
  dailyPerStreak: 2,
  dailyMax: 30,
  proDaily: 30,
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
  const value = isPro(profile) && !reason.startsWith("daily") ? amount * 2 : amount;
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
  /** Repeatable items (trial, boosts, chest) are not recorded as owned. */
  repeatable?: boolean;
  /** Pro members pay half for these. */
  proDiscount?: boolean;
  /** Daily purchase cap for repeatable items. */
  perDay?: number;
}

export const TITLES: Record<string, string> = {
  "title-ninja": "Финансовый ниндзя",
  "title-king": "Король копилки",
  "title-whale": "Крипто-кит",
};

export const SHOP: ShopItem[] = [
  { id: "pro-trial", title: "Пробный Pro на 7 дней", description: "Лимиты больше в 3–5 раз: 25 вопросов $PIG в день, 5 целей, 5 советов коуча. Без x2 монет и скидок полного Pro.", price: 1000, icon: "sparkle", repeatable: true },
  { id: "chest", title: "Сундук удачи", description: "От 10 до 300 PigCoin$. Повезёт? До 3 сундуков в день.", price: 60, icon: "coin", repeatable: true, perDay: 3 },
  { id: "boost-chat", title: "+10 вопросов $PIG", description: "Закончились вопросы? Ещё 10 на сегодня.", price: 80, icon: "message", repeatable: true, proDiscount: true },
  { id: "streak-freeze", title: "Заморозка серии", description: "Пропустите день, и серия не сгорит. Можно копить до 3 штук.", price: 150, icon: "shield", repeatable: true, proDiscount: true },
  { id: "title-ninja", title: "Титул «Финансовый ниндзя»", description: "Показывается рядом с именем", price: 300, icon: "target", proDiscount: true },
  { id: "title-king", title: "Титул «Король копилки»", description: "Для тех, кто копит красиво", price: 500, icon: "piggy", proDiscount: true },
  { id: "title-whale", title: "Титул «Крипто-кит»", description: "Самый редкий титул", price: 800, icon: "rocket", proDiscount: true },
  { id: "theme-car", title: "Обложка «Машина»", description: "Для цели на автомобиль", price: 120, icon: "car" },
  { id: "theme-rocket", title: "Обложка «Свой бизнес»", description: "Для стартового капитала", price: 120, icon: "rocket" },
  { id: "theme-heart", title: "Обложка «Для близких»", description: "Подарки, свадьба, семья", price: 120, icon: "heart" },
  { id: "theme-cap", title: "Обложка «Учёба»", description: "Курсы, вуз, обучение", price: 120, icon: "cap" },
  { id: "theme-gold", title: "Золотая обложка", description: "Для самой большой мечты", price: 250, icon: "coin" },
];

export const TRIAL_DAYS = 7;
const MAX_FREEZES = 3;
const CHEST_PRIZES = [10, 10, 20, 20, 30, 30, 40, 50, 60, 80, 100, 150, 300];

export const priceFor = (item: ShopItem, pro: boolean) => (pro && item.proDiscount ? Math.ceil(item.price / 2) : item.price);

export type BuyResult = { ok: true; coins: number; prize?: number; message?: string } | { ok: false; error: string };

export async function buyItem(userId: string, itemId: string): Promise<BuyResult> {
  const item = SHOP.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Такого товара нет" };
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true, streakFreezes: true } });
  const pro = isPro(profile);
  const price = priceFor(item, pro);
  let prize: number | undefined;
  let message: string | undefined;

  if (item.repeatable) {
    if (item.id === "pro-trial" && pro) return { ok: false, error: "У вас уже есть полный Pro" };
    if (item.id === "streak-freeze" && (profile?.streakFreezes ?? 0) >= MAX_FREEZES) return { ok: false, error: `Можно держать не больше ${MAX_FREEZES} заморозок` };
    if (item.perDay) {
      const today = await prisma.coinTx.count({ where: { userId, reason: `shop:${item.id}`, createdAt: { gte: startOfUtcDay() } } });
      if (today >= item.perDay) return { ok: false, error: "На сегодня лимит, приходите завтра" };
    }
    if (!(await spendCoins(userId, price, `shop:${item.id}`))) return { ok: false, error: "Не хватает PigCoin$" };
    if (item.id === "pro-trial") {
      const until = await extendLite(userId, TRIAL_DAYS);
      message = `Пробный Pro до ${until.toLocaleDateString("ru-RU")}`;
    } else if (item.id === "streak-freeze") {
      await prisma.profile.update({ where: { userId }, data: { streakFreezes: { increment: 1 } } });
    } else if (item.id === "chest") {
      prize = CHEST_PRIZES[Math.floor(Math.random() * CHEST_PRIZES.length)];
      await addCoins(userId, prize, "chest");
      message = `В сундуке ${prize} PigCoin$!`;
    }
  } else {
    // Spend and record ownership in one transaction: a double click can't charge twice.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.purchase.create({ data: { userId, itemId } });
        const r = await tx.profile.updateMany({ where: { userId, coins: { gte: price } }, data: { coins: { decrement: price } } });
        if (!r.count) throw new HttpError(402, "Не хватает PigCoin$");
        await tx.coinTx.create({ data: { userId, amount: -price, reason: `shop:${item.id}` } });
        if (TITLES[item.id]) await tx.profile.update({ where: { userId }, data: { title: TITLES[item.id] } });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: "Уже куплено" };
      if (e instanceof HttpError) return { ok: false, error: e.message };
      throw e;
    }
  }
  const p = await prisma.profile.findUnique({ where: { userId }, select: { coins: true } });
  return { ok: true, coins: p?.coins ?? 0, prize, message };
}

/** Switches the displayed title to one the user owns. */
export async function setTitle(userId: string, itemId: string | null) {
  if (itemId && (!TITLES[itemId] || !(await prisma.purchase.findUnique({ where: { userId_itemId: { userId, itemId } } })))) throw new HttpError(403, "Этот титул ещё не куплен");
  await prisma.profile.update({ where: { userId }, data: { title: itemId ? TITLES[itemId] : "" } });
}

async function extendLite(userId: string, days: number): Promise<Date> {
  const p = await prisma.profile.findUnique({ where: { userId }, select: { liteUntil: true } });
  const base = p?.liteUntil && p.liteUntil.getTime() > Date.now() ? p.liteUntil : new Date();
  const until = new Date(base.getTime() + days * 86_400_000);
  await prisma.profile.update({ where: { userId }, data: { liteUntil: until } });
  return until;
}

/** Daily bonus for showing up: grows with the streak; Pro gets an extra bonus. Paid once per UTC day. */
export async function claimDailyBonus(userId: string, streak: number): Promise<number> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
  let got = await addDailyCoins(userId, Math.min(COINS.dailyMax, COINS.dailyBase + COINS.dailyPerStreak * streak), "daily");
  if (got && isPro(profile)) got += await addDailyCoins(userId, COINS.proDaily, "daily-pro");
  return got;
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
