import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isPro, startOfUtcDay } from "@/lib/billing/plan";
import { HttpError } from "@/lib/api/http";
import { advisoryLock } from "@/lib/db/lock";

/** PigCoin$: earned for learning and saving, spent in the shop. Every change goes through the CoinTx ledger. */
export const COINS = {
  dailyDeposit: 10,
  milestone: 30,
  resistedSpend: 10,
  /** Daily login bonus: base + per streak day, capped; Pro adds proDaily on top. */
  dailyBase: 5,
  dailyPerStreak: 1,
  dailyMax: 15,
  proDaily: 15,
  /** PigCoin$ per XP point (Free); Pro gets x2. */
  perXp: 0.5,
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
      prisma.profile.upsert({ where: { userId }, update: { coins: { increment: value } }, create: { userId, coins: value } }),
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

export type ShopCategory = "boost" | "access" | "style";

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: string;
  category: ShopCategory;
  /** Repeatable items (trial, boosts, chest) are not recorded as owned. */
  repeatable?: boolean;
  /** Pro members pay half for these. */
  proDiscount?: boolean;
  /** Daily purchase cap for repeatable items. */
  perDay?: number;
  /** Not offered to Pro (already included). */
  notForPro?: boolean;
}

export const TITLES: Record<string, string> = {
  "title-ninja": "Финансовый ниндзя",
  "title-king": "Король копилки",
  "title-whale": "Крипто-кит",
  "title-oracle": "Финансовый оракул",
  "title-legend": "Легенда PIGSEN",
};

/** Cosmetics shown on the profile and the leaderboard. Bought = equipped; owned ones can be switched. */
export const STYLES: Record<string, { field: "nameColor" | "avatarRing"; value: string }> = {
  "name-gold": { field: "nameColor", value: "gold" },
  "name-emerald": { field: "nameColor", value: "emerald" },
  "name-violet": { field: "nameColor", value: "violet" },
  "ring-gold": { field: "avatarRing", value: "gold" },
  "ring-fire": { field: "avatarRing", value: "fire" },
};

export const XP_BOOST_HOURS = 24;
export const PASS_DAYS = 3;
export const MAX_EXTRA_GOALS = 3;

export const SHOP: ShopItem[] = [
  // Буст
  { id: "chest", category: "boost", title: "Сундук удачи", description: "От 5 до 120 PigCoin$. До 3 сундуков в день.", price: 60, icon: "coin", repeatable: true, perDay: 3 },
  { id: "chest-gold", category: "boost", title: "Золотой сундук", description: "От 100 до 600 PigCoin$. Один в день.", price: 300, icon: "sparkle", repeatable: true, perDay: 1 },
  { id: "boost-chat", category: "boost", title: "+10 вопросов $PIG", description: "Закончились вопросы? Ещё 10 на сегодня.", price: 80, icon: "message", repeatable: true, proDiscount: true, notForPro: true },
  { id: "boost-chat-30", category: "boost", title: "+30 вопросов $PIG", description: "Большой пакет вопросов к $PIG на сегодня.", price: 200, icon: "message", repeatable: true, notForPro: true },
  { id: "xp-boost", category: "boost", title: "Двойной XP на 24 часа", description: "Уроки, квизы и разборы идей дают x2 XP: уровень растёт вдвое быстрее. Монеты и очки лидерборда не удваиваются.", price: 250, icon: "rocket", repeatable: true, proDiscount: true },
  { id: "streak-freeze", category: "boost", title: "Заморозка серии", description: "Пропустите день, и серия не сгорит. Можно копить до 3 штук.", price: 150, icon: "shield", repeatable: true, proDiscount: true, notForPro: true },
  // Доступ
  { id: "pro-trial", category: "access", title: "Пробный Pro на 7 дней", description: "Лимиты больше в 3–5 раз: 25 вопросов $PIG в день, 5 целей, 5 советов коуча. Без эксклюзивных курсов, x2 монет и скидок полного Pro.", price: 1000, icon: "sparkle", repeatable: true, notForPro: true },
  { id: "pro-pass", category: "access", title: "Pro-материалы на 3 дня", description: "Открывает все эксклюзивные курсы и статьи Pro на 3 дня. Пройденные уроки остаются засчитанными.", price: 700, icon: "book", repeatable: true, notForPro: true },
  { id: "goal-slot", category: "access", title: "+1 цель в копилке", description: `Навсегда добавляет место для ещё одной цели. Можно купить до ${MAX_EXTRA_GOALS} раз.`, price: 400, icon: "piggy", repeatable: true, notForPro: true },
  // Стиль
  { id: "name-emerald", category: "style", title: "Изумрудное имя", description: "Имя зелёным в профиле и лидерборде.", price: 300, icon: "sparkle", proDiscount: true },
  { id: "name-violet", category: "style", title: "Фиолетовое имя", description: "Имя фиолетовым в профиле и лидерборде.", price: 300, icon: "sparkle", proDiscount: true },
  { id: "name-gold", category: "style", title: "Золотое имя", description: "Имя с золотым градиентом в профиле и лидерборде.", price: 600, icon: "coin", proDiscount: true },
  { id: "ring-gold", category: "style", title: "Золотая рамка аватара", description: "Золотое кольцо вокруг аватара в профиле и лидерборде.", price: 500, icon: "target", proDiscount: true },
  { id: "ring-fire", category: "style", title: "Огненная рамка аватара", description: "Огненное кольцо вокруг аватара в профиле и лидерборде.", price: 800, icon: "rocket", proDiscount: true },
  { id: "title-ninja", category: "style", title: "Титул «Финансовый ниндзя»", description: "Показывается рядом с именем", price: 300, icon: "target", proDiscount: true },
  { id: "title-king", category: "style", title: "Титул «Король копилки»", description: "Для тех, кто копит красиво", price: 500, icon: "piggy", proDiscount: true },
  { id: "title-whale", category: "style", title: "Титул «Крипто-кит»", description: "Редкий титул", price: 800, icon: "rocket", proDiscount: true },
  { id: "title-oracle", category: "style", title: "Титул «Финансовый оракул»", description: "Для тех, кто видит рынок насквозь", price: 1200, icon: "bulb", proDiscount: true },
  { id: "title-legend", category: "style", title: "Титул «Легенда PIGSEN»", description: "Самый редкий титул магазина", price: 2500, icon: "sparkle", proDiscount: true },
  { id: "theme-car", category: "style", title: "Обложка «Машина»", description: "Для цели на автомобиль", price: 120, icon: "car" },
  { id: "theme-rocket", category: "style", title: "Обложка «Свой бизнес»", description: "Для стартового капитала", price: 120, icon: "rocket" },
  { id: "theme-heart", category: "style", title: "Обложка «Для близких»", description: "Подарки, свадьба, семья", price: 120, icon: "heart" },
  { id: "theme-cap", category: "style", title: "Обложка «Учёба»", description: "Курсы, вуз, обучение", price: 120, icon: "cap" },
  { id: "theme-gold", category: "style", title: "Золотая обложка", description: "Для самой большой мечты", price: 250, icon: "coin" },
];

export const TRIAL_DAYS = 7;
const MAX_FREEZES = 3;
/** Chests are coin sinks: mean prize ~45 for 60 and ~256 for 300. */
const CHEST_PRIZES: Record<string, number[]> = {
  chest: [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 90, 120],
  "chest-gold": [100, 120, 150, 180, 200, 250, 300, 400, 600],
};

const later = (base: Date | null | undefined, ms: number) => new Date((base && base.getTime() > Date.now() ? base.getTime() : Date.now()) + ms);

export const priceFor = (item: ShopItem, pro: boolean) => (pro && item.proDiscount ? Math.ceil(item.price / 2) : item.price);

export type BuyResult = { ok: true; coins: number; prize?: number; message?: string } | { ok: false; error: string };

export async function buyItem(userId: string, itemId: string): Promise<BuyResult> {
  const item = SHOP.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Такого товара нет" };
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
  const pro = isPro(profile);
  const price = priceFor(item, pro);
  let prize: number | undefined;
  let message: string | undefined;

  if (item.repeatable) {
    if (item.notForPro && pro) return { ok: false, error: "Это уже входит в ваш Pro" };
    // Per-user lock: caps (per day, max freezes) are checked and the coins spent atomically.
    const r = await prisma.$transaction(async (tx): Promise<{ error: string } | { prize?: number; message?: string }> => {
      await advisoryLock(tx, userId);
      if (item.id === "streak-freeze") {
        const p = await tx.profile.findUnique({ where: { userId }, select: { streakFreezes: true } });
        if ((p?.streakFreezes ?? 0) >= MAX_FREEZES) return { error: `Можно держать не больше ${MAX_FREEZES} заморозок` };
      }
      if (item.id === "goal-slot") {
        const p = await tx.profile.findUnique({ where: { userId }, select: { extraGoals: true } });
        if ((p?.extraGoals ?? 0) >= MAX_EXTRA_GOALS) return { error: `Можно купить не больше ${MAX_EXTRA_GOALS} дополнительных целей` };
      }
      if (item.perDay) {
        const today = await tx.coinTx.count({ where: { userId, reason: `shop:${item.id}`, createdAt: { gte: startOfUtcDay() } } });
        if (today >= item.perDay) return { error: "На сегодня лимит, приходите завтра" };
      }
      const spent = await tx.profile.updateMany({ where: { userId, coins: { gte: price } }, data: { coins: { decrement: price } } });
      if (!spent.count) return { error: "Не хватает PigCoin$" };
      await tx.coinTx.create({ data: { userId, amount: -price, reason: `shop:${item.id}` } });
      if (item.id === "pro-trial") {
        const p = await tx.profile.findUnique({ where: { userId }, select: { liteUntil: true } });
        const base = p?.liteUntil && p.liteUntil.getTime() > Date.now() ? p.liteUntil : new Date();
        const until = new Date(base.getTime() + TRIAL_DAYS * 86_400_000);
        await tx.profile.update({ where: { userId }, data: { liteUntil: until } });
        return { message: `Пробный Pro до ${until.toLocaleDateString("ru-RU")}` };
      }
      if (item.id === "streak-freeze") {
        await tx.profile.update({ where: { userId }, data: { streakFreezes: { increment: 1 } } });
      } else if (item.id === "goal-slot") {
        await tx.profile.update({ where: { userId }, data: { extraGoals: { increment: 1 } } });
        return { message: "Теперь можно создать ещё одну цель" };
      } else if (item.id === "xp-boost") {
        const p = await tx.profile.findUnique({ where: { userId }, select: { xpBoostUntil: true } });
        const until = later(p?.xpBoostUntil, XP_BOOST_HOURS * 3_600_000);
        await tx.profile.update({ where: { userId }, data: { xpBoostUntil: until } });
        return { message: `Двойной XP до ${until.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })} (МСК)` };
      } else if (item.id === "pro-pass") {
        const p = await tx.profile.findUnique({ where: { userId }, select: { passUntil: true } });
        const until = later(p?.passUntil, PASS_DAYS * 86_400_000);
        await tx.profile.update({ where: { userId }, data: { passUntil: until } });
        return { message: `Pro-материалы открыты до ${until.toLocaleDateString("ru-RU")}` };
      } else if (CHEST_PRIZES[item.id]) {
        const prizes = CHEST_PRIZES[item.id];
        const won = prizes[Math.floor(Math.random() * prizes.length)];
        await tx.profile.update({ where: { userId }, data: { coins: { increment: won } } });
        await tx.coinTx.create({ data: { userId, amount: won, reason: "chest" } });
        return { prize: won, message: `В сундуке ${won} PigCoin$!` };
      }
      return {};
    });
    if ("error" in r) return { ok: false, error: r.error };
    prize = r.prize;
    message = r.message;
  } else {
    // Spend and record ownership in one transaction: a double click can't charge twice.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.purchase.create({ data: { userId, itemId } });
        const r = await tx.profile.updateMany({ where: { userId, coins: { gte: price } }, data: { coins: { decrement: price } } });
        if (!r.count) throw new HttpError(402, "Не хватает PigCoin$");
        await tx.coinTx.create({ data: { userId, amount: -price, reason: `shop:${item.id}` } });
        if (TITLES[item.id]) await tx.profile.update({ where: { userId }, data: { title: TITLES[item.id] } });
        const style = STYLES[item.id];
        if (style) await tx.profile.update({ where: { userId }, data: { [style.field]: style.value } });
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

/** Equips an owned cosmetic (title, name color, avatar ring), or clears that slot when `off`. */
export async function equipItem(userId: string, itemId: string, off = false) {
  const style = STYLES[itemId];
  if (!style && !TITLES[itemId]) throw new HttpError(400, "Этот товар нельзя надеть");
  if (!(await prisma.purchase.findUnique({ where: { userId_itemId: { userId, itemId } } }))) throw new HttpError(403, "Сначала купите этот товар");
  const data = style ? { [style.field]: off ? "" : style.value } : { title: off ? "" : TITLES[itemId] };
  await prisma.profile.update({ where: { userId }, data });
}

/** Credits PigCoin$ bought with Telegram Stars: claims the payment and pays exactly once. */
export async function creditStarsCoins(paymentId: string, chargeId: string, coins: number): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id: paymentId, applied: false }, data: { applied: true, status: "succeeded", providerRef: chargeId } });
    if (!claimed.count) return false;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { userId: true, plan: true } });
    await tx.profile.upsert({ where: { userId: p.userId }, update: { coins: { increment: coins } }, create: { userId: p.userId, coins } });
    await tx.coinTx.create({ data: { userId: p.userId, amount: coins, reason: `stars:${p.plan}` } });
    return true;
  });
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
