import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/ai/aiService";
import { FREE_LIMITS, isPro, startOfUtcDay } from "@/lib/billing/plan";
import { addDailyCoins, COINS } from "@/lib/coins/service";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { getGoal, goalStats } from "./service";

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

/** Usage counter for daily free allowances, kept in the coin ledger with amount 0. */
async function consumeAllowance(userId: string, kind: string, limit: number): Promise<boolean> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } });
  if (isPro(profile)) return true;
  const used = await prisma.coinTx.count({ where: { userId, reason: `use:${kind}`, createdAt: { gte: startOfUtcDay() } } });
  if (used >= limit) return false;
  await prisma.coinTx.create({ data: { userId, amount: 0, reason: `use:${kind}` } });
  return true;
}

// ---------- Coach ----------

const CoachSchema = z.object({
  message: z.string().min(5).max(600),
  plan: z.array(z.string().min(2).max(300)).min(1).max(5),
  challenge: z.string().min(5).max(300),
});
export type CoachAdvice = z.infer<typeof CoachSchema> & { demo: boolean };

const COACH_SYSTEM = `Ты — $PIG, дружелюбный коуч по накоплениям на платформе PIGSEN. Тебе дают цель пользователя и цифры.
Поддержи человека, оцени реалистичность цели и дай конкретный план. Пиши тепло, на «ты», без морализаторства, с цифрами в рублях.
Верни ТОЛЬКО JSON без markdown:
{"message":"2–3 предложения поддержки и честной оценки","plan":["3 конкретных шага с суммами"],"challenge":"одно маленькое задание на эту неделю"}
Не давай персональных инвестиционных рекомендаций и не советуй конкретные акции или монеты.`;

function fallbackCoach(title: string, s: Awaited<ReturnType<typeof goalStats>>): Omit<CoachAdvice, "demo"> {
  const weekly = s.needPerMonth !== null ? s.needPerMonth / 4.3 : null;
  const message =
    s.percent >= 100
      ? `Цель «${title}» достигнута! Это результат дисциплины, а не удачи. Самое время поставить следующую.`
      : s.pacePerDay > 0
        ? `Ты уже накопил ${s.percent}% цели «${title}». При текущем темпе (около ${rub(s.pacePerDay * 30)} в месяц) осталось ${rub(s.left)}.`
        : `Цель «${title}» ждёт первого шага. Даже небольшой регулярный взнос важнее, чем крупный, но когда-нибудь.`;
  return {
    message,
    plan: [
      weekly !== null && weekly > 0 ? `Откладывай по ${rub(weekly)} в неделю, чтобы успеть к сроку.` : "Выбери фиксированную сумму и откладывай её каждую неделю в один и тот же день.",
      "Настрой автоперевод в день зарплаты: сначала платишь себе, потом тратишь остальное.",
      "Перед каждой покупкой дороже 2 000 ₽ проверяй её в «Что если потрачу».",
    ],
    challenge: "Неделя без одной привычной траты (доставка, такси или кофе с собой). Сэкономленное — сразу в копилку.",
  };
}

export async function coachAdvice(userId: string, goalId: string): Promise<CoachAdvice> {
  const goal = await getGoal(userId, goalId);
  if (!goal) throw new HttpError(404, "Цель не найдена");
  const s = await goalStats(goal);
  const allowed = await consumeAllowance(userId, "coach", FREE_LIMITS.coachPerDay);
  if (!allowed) return { ...fallbackCoach(goal.title, s), demo: true };
  const prompt = `Цель: «${goal.title}». Зачем: ${goal.why || "не указано"}.
Нужно: ${rub(goal.target)}. Накоплено: ${rub(goal.saved)} (${s.percent}%). Осталось: ${rub(s.left)}.
Срок: ${goal.deadline ? `${goal.deadline.toISOString().slice(0, 10)} (через ${s.daysLeft} дн.), нужно ${rub(s.needPerMonth ?? 0)} в месяц` : "не задан"}.
Текущий темп: ${rub(s.pacePerDay * 30)} в месяц.${s.eta ? ` При таком темпе цель будет достигнута около ${s.eta.toISOString().slice(0, 10)}.` : ""}`;
  const ai = await completeJson(COACH_SYSTEM, prompt, (raw) => {
    const r = CoachSchema.safeParse(raw);
    return r.success ? r.data : null;
  });
  return ai ? { ...ai, demo: false } : { ...fallbackCoach(goal.title, s), demo: true };
}

// ---------- "What if I spend it?" ----------

const SpendSchema = z.object({
  verdict: z.string().min(5).max(400),
  tip: z.string().min(5).max(300),
  alternative: z.string().min(5).max(300),
});

export interface SpendCheck {
  amount: number;
  percentOfGoal: number | null;
  delayDays: number | null;
  goalTitle: string | null;
  /** What the same money could become if invested at ~8% a year (illustration, not a promise). */
  future5: number;
  future10: number;
  verdict: string;
  tip: string;
  alternative: string;
  demo: boolean;
}

const SPEND_SYSTEM = `Ты — $PIG, финансовый наставник PIGSEN. Пользователь думает, потратить ли деньги. Тебе дают сумму, покупку и влияние на его цель накоплений.
Не стыди и не запрещай: помоги принять осознанное решение. Различай нужды и импульсные траты.
Верни ТОЛЬКО JSON без markdown: {"verdict":"1–2 предложения: что значит эта трата для цели","tip":"как решить: правило 24 часов, сравнение цен и т. п.","alternative":"дешёвая альтернатива или компромисс"}. Язык — русский, на «ты».`;

export async function checkSpend(userId: string, amount: number, item: string, goalId: string | null): Promise<SpendCheck> {
  const goal = goalId ? await getGoal(userId, goalId) : null;
  const s = goal ? await goalStats(goal) : null;
  const percentOfGoal = goal ? Math.round((amount / goal.target) * 1000) / 10 : null;
  const delayDays = s && s.pacePerDay > 0 ? Math.ceil(amount / s.pacePerDay) : null;
  const future5 = amount * Math.pow(1.08, 5);
  const future10 = amount * Math.pow(1.08, 10);
  const base = { amount, percentOfGoal, delayDays, goalTitle: goal?.title ?? null, future5, future10 };

  const facts = `Покупка: ${item || "не указана"} за ${rub(amount)}.${goal ? ` Цель: «${goal.title}», осталось накопить ${rub(s!.left)}; трата = ${percentOfGoal}% цели${delayDays ? `, отодвинет цель примерно на ${delayDays} дн.` : ""}.` : " Цели не выбрано."} Если вложить под 8% годовых, через 10 лет было бы около ${rub(future10)}.`;
  const allowed = await consumeAllowance(userId, "spend", FREE_LIMITS.spendAiPerDay);
  const ai = allowed
    ? await completeJson(SPEND_SYSTEM, facts, (raw) => {
        const r = SpendSchema.safeParse(raw);
        return r.success ? r.data : null;
      })
    : null;
  if (ai) return { ...base, ...ai, demo: false };
  return {
    ...base,
    verdict: goal
      ? `Эта покупка — ${percentOfGoal}% цели «${goal.title}»${delayDays ? ` и отодвинет её примерно на ${delayDays} дн.` : "."}`
      : `${rub(amount)} сегодня — это около ${rub(future10)} через 10 лет, если бы они работали под 8% годовых.`,
    tip: "Правило 24 часов: отложи решение на сутки. Если желание осталось и покупка решает реальную задачу, бери спокойно.",
    alternative: "Поищи б/у, аренду или вариант попроще. А разницу отправь в копилку.",
    demo: true,
  };
}

/** The user decided not to spend: the reward is paid at most once a day. */
export async function resistedSpendReward(userId: string): Promise<number> {
  return addDailyCoins(userId, COINS.resistedSpend, "resisted");
}
