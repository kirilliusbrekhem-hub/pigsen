import "server-only";

type PlanProfile = { proUntil: Date | null; liteUntil?: Date | null } | null | undefined;

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
}

/** Daily allowances per tier; Pro is unlimited (still rate-limited per minute). */
export const LIMITS: Record<Tier, Limits> = {
  free: { goals: 2, chat: 7, coach: 1, spend: 2, idea: 1, quiz: 5 },
  lite: { goals: 5, chat: 25, coach: 5, spend: 10, idea: 5, quiz: 15 },
  pro: { goals: Infinity, chat: Infinity, coach: Infinity, spend: Infinity, idea: Infinity, quiz: 40 },
};
export const FREE_LIMITS = LIMITS.free;

export const limitsFor = (profile: PlanProfile): Limits => LIMITS[tierOf(profile)];

export const PLANS = {
  month: { id: "month", title: "Pro на месяц", price: 299, stars: Number(process.env.STARS_MONTH) || 250, days: 30 },
  year: { id: "year", title: "Pro на год", price: 2490, stars: Number(process.env.STARS_YEAR) || 2000, days: 365 },
} as const;
export type PlanId = keyof typeof PLANS;

export const PRO_PERKS = [
  "Эксклюзивные курсы и материалы: финплан, инвестиции, запуск бизнеса, переговоры",
  "Безлимитный чат с $PIG (на Free 7 вопросов в день)",
  "Безлимитный $PIG-коуч и разбор трат «что если потрачу»",
  "Безлимитный разбор бизнес-идей",
  "Сколько угодно целей в копилке (на Free 2)",
  "x2 PigCoin$ за всё: уроки, квизы, взносы",
  "+30 PigCoin$ каждый день просто за вход",
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
  { label: "PigCoin$ за обучение", free: "x1", lite: "x1", pro: "x2" },
  { label: "Ежедневный бонус", free: "до 30", lite: "до 30", pro: "до 60" },
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
