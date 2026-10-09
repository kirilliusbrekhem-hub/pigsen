import "server-only";

type PlanProfile = { proUntil: Date | null; liteUntil?: Date | null; passUntil?: Date | null; extraGoals?: number; proTier?: string | null } | null | undefined;

/** Pro is active while proUntil is in the future. */
export function isPro(profile: PlanProfile): boolean {
  return !!profile?.proUntil && profile.proUntil.getTime() > Date.now();
}

/** Pro trial bought for PigCoin$: raised limits, but not full Pro. */
export function isLite(profile: PlanProfile): boolean {
  return !isPro(profile) && !!profile?.liteUntil && profile.liteUntil.getTime() > Date.now();
}

export type Tier = "free" | "lite" | "pro";
export function tierOf(profile: PlanProfile): Tier {
  return isPro(profile) ? "pro" : isLite(profile) ? "lite" : "free";
}

export type LimitKind = "chat" | "coach" | "spend" | "idea" | "quiz";
export interface Limits {
  goals: number;
  chat: number;
  coach: number;
  spend: number;
  idea: number;
  quiz: number;
  /** People in a «Мой бизнес» team, founder included (Pro tiers: see TEAM_CAPS). */
  team: number;
}

/** Daily allowances per tier; Pro is unlimited (still rate-limited per minute). */
export const LIMITS: Record<Tier, Limits> = {
  free: { goals: 2, chat: 7, coach: 1, spend: 2, idea: 1, quiz: 5, team: 2 },
  lite: { goals: 5, chat: 25, coach: 5, spend: 10, idea: 5, quiz: 15, team: 2 },
  pro: { goals: Infinity, chat: Infinity, coach: Infinity, spend: Infinity, idea: Infinity, quiz: 40, team: 4 },
};

/**
 * Pro tiers by team size. Every tier is full Pro (all perks); only the «Мой бизнес» team cap differs.
 * The tier of the last paid plan is stored in Profile.proTier.
 */
export type ProTier = "pro" | "pro7" | "pro10";
export const TEAM_CAPS: Record<ProTier, number> = { pro: 4, pro7: 7, pro10: 10 };
export const PRO_TIER_NAMES: Record<ProTier, string> = { pro: "Pro", pro7: "Pro 7", pro10: "Pro 10" };
export const proTierOf = (profile: PlanProfile): ProTier | null =>
  isPro(profile) ? (profile?.proTier === "pro7" || profile?.proTier === "pro10" ? profile.proTier : "pro") : null;

/** Max people (founder included) in a business founded by this user: Free = founder + 1 friend. */
export function teamCap(user: { profile?: PlanProfile } | PlanProfile): number {
  const profile = user && "profile" in user ? user.profile : (user as PlanProfile);
  const tier = proTierOf(profile);
  return tier ? TEAM_CAPS[tier] : LIMITS.free.team;
}
export const FREE_LIMITS = LIMITS.free;

export const limitsFor = (profile: PlanProfile): Limits => LIMITS[tierOf(profile)];

/** Savings goal cap: plan limit plus slots bought in the shop. */
export const goalLimit = (profile: PlanProfile): number => limitsFor(profile).goals + (profile?.extraGoals ?? 0);

/** Exclusive courses/articles: Pro, or a "Pro-материалы" pass bought for PigCoin$. */
export const hasPremium = (profile: PlanProfile): boolean => isPro(profile) || (!!profile?.passUntil && profile.passUntil.getTime() > Date.now());

/**
 * PigCoin$ packs for Telegram Stars. Priced above Pro on purpose: 1000 coins (a 7-day trial) cost more than a month of Pro,
 * so buying coins is never a cheap way around the subscription.
 */
export const COIN_PACKS = {
  "coins-300": { id: "coins-300", coins: 300, stars: 99 },
  "coins-1000": { id: "coins-1000", coins: 1000, stars: 299 },
  "coins-3000": { id: "coins-3000", coins: 3000, stars: 799 },
} as const;
export type PackId = keyof typeof COIN_PACKS;
export const PACK_IDS = Object.keys(COIN_PACKS) as [PackId, ...PackId[]];

/** Monthly plans are Telegram Stars subscriptions (recurring), yearly ones are one-off payments. */
export const PLANS = {
  month: { id: "month", tier: "pro", title: "Pro на месяц", price: 299, stars: Number(process.env.STARS_MONTH) || 250, days: 30, recurring: true },
  year: { id: "year", tier: "pro", title: "Pro на год", price: 2490, stars: Number(process.env.STARS_YEAR) || 2000, days: 365, recurring: false },
  month7: { id: "month7", tier: "pro7", title: "Pro 7 на месяц", price: 379, stars: 320, days: 30, recurring: true },
  year7: { id: "year7", tier: "pro7", title: "Pro 7 на год", price: 2990, stars: 2500, days: 365, recurring: false },
  month10: { id: "month10", tier: "pro10", title: "Pro 10 на месяц", price: 459, stars: 390, days: 30, recurring: true },
  year10: { id: "year10", tier: "pro10", title: "Pro 10 на год", price: 3590, stars: 3000, days: 365, recurring: false },
} as const satisfies Record<string, { id: string; tier: ProTier; title: string; price: number; stars: number; days: number; recurring: boolean }>;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as [PlanId, ...PlanId[]];
export const isPlanId = (id: string): id is PlanId => id in PLANS;

export const PRO_PERKS = [
  "Эксклюзивные курсы и материалы: финплан, инвестиции, запуск бизнеса, переговоры",
  "Безлимитный чат с $PIG (на Free 7 вопросов в день)",
  "Безлимитный $PIG-коуч и разбор трат «что если потрачу»",
  "Безлимитный разбор бизнес-идей",
  "Сколько угодно целей в копилке (на Free 2)",
  "x2 PigCoin$ за всё: уроки, квизы, взносы",
  "+15 PigCoin$ каждый день сверх обычного бонуса",
  "Серия не сгорает, если пропустил один день",
  "Скидка 50% в магазине и все обложки бесплатно",
  "Закрытое комьюнити Pro: посты, ответы, нетворкинг",
  "Недельный лидерборд с призами: до 30 дней Pro и 2000 PigCoin$",
  "Все офлайн-челленджи (на Free 3)",
  "Золотой значок Pro в профиле",
];

/** Rows for the Free / trial / Pro comparison table. */
export const COMPARE: { label: string; free: string; lite: string; pro: string }[] = [
  { label: "Эксклюзивные курсы и материалы", free: "превью", lite: "превью", pro: "✓" },
  { label: "Вопросы $PIG в день", free: "7", lite: "25", pro: "∞" },
  { label: "Советы коуча в день", free: "1", lite: "5", pro: "∞" },
  { label: "«Что если потрачу» в день", free: "2", lite: "10", pro: "∞" },
  { label: "Разбор идей в день", free: "1", lite: "5", pro: "∞" },
  { label: "Квизы по урокам в день", free: "5", lite: "15", pro: "40" },
  { label: "Цели в копилке", free: "2", lite: "5", pro: "∞" },
  { label: "Команда в «Моём бизнесе»", free: "2", lite: "2", pro: "4 · 7 · 10" },
  { label: "PigCoin$ за обучение", free: "x1", lite: "x1", pro: "x2" },
  { label: "Ежедневный бонус", free: "до 15", lite: "до 15", pro: "до 30" },
  { label: "Защита серии", free: "—", lite: "—", pro: "✓" },
  { label: "Комьюнити Pro", free: "превью", lite: "превью", pro: "✓" },
  { label: "Призы недельного лидерборда", free: "—", lite: "—", pro: "✓" },
  { label: "Офлайн-челленджи", free: "3", lite: "3", pro: "все" },
  { label: "Скидка в магазине", free: "—", lite: "—", pro: "50%" },
];

export function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
