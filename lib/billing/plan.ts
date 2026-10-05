import "server-only";

/** Pro is active while proUntil is in the future. */
export function isPro(profile: { proUntil: Date | null } | null | undefined): boolean {
  return !!profile?.proUntil && profile.proUntil.getTime() > Date.now();
}

/** Daily allowances on the free plan; Pro is unlimited (still rate-limited per minute). */
export const FREE_LIMITS = {
  goals: 3,
  coachPerDay: 3,
  spendAiPerDay: 5,
  ideaPerDay: 3,
} as const;

export const PLANS = {
  month: { id: "month", title: "Pro на месяц", price: 299, stars: Number(process.env.STARS_MONTH) || 250, days: 30 },
  year: { id: "year", title: "Pro на год", price: 2490, stars: Number(process.env.STARS_YEAR) || 2000, days: 365 },
} as const;
export type PlanId = keyof typeof PLANS;

export const PRO_PERKS = [
  "Безлимитные советы $PIG-коуча по накоплениям",
  "$PIG разбирает каждую трату «что если потрачу»",
  "Сколько угодно целей в копилке",
  "Все премиум-обложки целей",
  "Безлимитный разбор бизнес-идей",
  "x2 PigCoin$ за взносы в копилку",
];

export function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
