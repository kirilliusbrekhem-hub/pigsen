import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/ai/aiService";
import { consumeAllowance } from "@/lib/billing/limits";
import { addDailyCoins, COINS } from "@/lib/coins/service";
import { HttpError } from "@/lib/api/http";
import { getGoal, goalStats } from "./service";
import { prisma } from "@/lib/db/prisma";
import { pigModeOf, type PigMode } from "@/lib/ai/pigMode";

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

// ---------- Coach ----------

const CoachSchema = z.object({
  message: z.string().min(5).max(600),
  plan: z.array(z.string().min(2).max(300)).min(1).max(5),
  challenge: z.string().min(5).max(300),
});
export type CoachAdvice = z.infer<typeof CoachSchema> & { demo: boolean; mode: PigMode };

/** Free: explains what the numbers mean and how to plan — no personal plan, no partner persona. */
const EDU_SYSTEM = `Ты — CAP, образовательный ассистент по накоплениям на платформе Kapital (план Free). Тебе дают цель пользователя и цифры.
Объясни простым языком, что значат эти цифры (темп, сколько нужно в месяц, срок) и какие общие принципы помогают копить. Не составляй персональный план с конкретными суммами для пользователя и не предлагай идей от себя — только объяснения и как посчитать самому. Нейтральный тон, без образа персонажа.
Верни ТОЛЬКО JSON без markdown:
{"message":"2–3 предложения: что показывают цифры цели","plan":["3 объяснения принципов: как считать взнос, зачем автоперевод, что такое подушка"],"challenge":"одно упражнение, чтобы разобраться в своих цифрах"}
Это обучение, а не индивидуальная рекомендация. Не советуй конкретные акции или монеты.`;

const COACH_SYSTEM = `Ты — CAP, личный партнёр по накоплениям (план Pro): дружелюбный, немного дерзкий, на платформе Kapital. Тебе дают цель пользователя и цифры.
Поддержи человека, оцени реалистичность цели и дай личный план. Предложи одну идею от себя в формате «Давай попробуем: …» и закончи напоминанием заглянуть завтра. Пиши тепло, на «ты», без морализаторства, с цифрами в рублях.
Верни ТОЛЬКО JSON без markdown:
{"message":"2–3 предложения поддержки и честной оценки","plan":["3 конкретных шага с суммами, последний — «Давай попробуем: …»"],"challenge":"одно маленькое задание на эту неделю"}
Это обучение, а не индивидуальная инвестиционная рекомендация: не советуй конкретные акции или монеты.`;

function fallbackCoach(title: string, s: Awaited<ReturnType<typeof goalStats>>): Omit<CoachAdvice, "demo" | "mode"> {
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
      "Давай попробуем: перед каждой покупкой дороже 2 000 ₽ проверяй её в «Что если потрачу». Завтра сверим, сколько сэкономили.",
    ],
    challenge: "Неделя без одной привычной траты (доставка, такси или кофе с собой). Сэкономленное — сразу в копилку.",
  };
}

/** Free: explanations of the numbers and principles, no personal plan. */
function fallbackEdu(title: string, s: Awaited<ReturnType<typeof goalStats>>): Omit<CoachAdvice, "demo" | "mode"> {
  return {
    message: `Цель «${title}» выполнена на ${s.percent}%. Темп — это сколько в среднем вы откладывали за последние 1–2 месяца; если он ниже нужного взноса в месяц, срок сдвигается.`,
    plan: [
      "Как посчитать взнос: оставшаяся сумма ÷ число месяцев до срока. Округлите вверх — так появится запас.",
      "Почему работает автоперевод: деньги уходят в копилку до того, как вы начнёте их тратить («сначала заплати себе»).",
      "Подушка безопасности — 3–6 месяцев обязательных расходов. Её копят раньше остальных целей.",
    ],
    challenge: "Выпишите обязательные расходы за месяц и посчитайте, какой взнос вам комфортен без ущерба для них.",
  };
}

export async function coachAdvice(userId: string, goalId: string): Promise<CoachAdvice> {
  const goal = await getGoal(userId, goalId);
  if (!goal) throw new HttpError(404, "Цель не найдена");
  const s = await goalStats(goal);
  const mode = pigModeOf(await prisma.profile.findUnique({ where: { userId }, select: { proUntil: true } }));
  const fallback = () => ({ ...(mode === "partner" ? fallbackCoach(goal.title, s) : fallbackEdu(goal.title, s)), demo: true, mode });
  const allowed = await consumeAllowance(userId, "coach");
  if (!allowed) return fallback();
  const prompt = `Цель: «${goal.title}». Зачем: ${goal.why || "не указано"}.
Нужно: ${rub(goal.target)}. Накоплено: ${rub(goal.saved)} (${s.percent}%). Осталось: ${rub(s.left)}.
Срок: ${goal.deadline ? `${goal.deadline.toISOString().slice(0, 10)} (через ${s.daysLeft} дн.), нужно ${rub(s.needPerMonth ?? 0)} в месяц` : "не задан"}.
Текущий темп: ${rub(s.pacePerDay * 30)} в месяц.${s.eta ? ` При таком темпе цель будет достигнута около ${s.eta.toISOString().slice(0, 10)}.` : ""}`;
  const ai = await completeJson(mode === "partner" ? COACH_SYSTEM : EDU_SYSTEM, prompt, (raw) => {
    const r = CoachSchema.safeParse(raw);
    return r.success ? r.data : null;
  });
  return ai ? { ...ai, demo: false, mode } : fallback();
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

const SPEND_SYSTEM = `Ты — CAP, финансовый наставник Kapital. Пользователь думает, потратить ли деньги. Тебе дают сумму, покупку и влияние на его цель накоплений.
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
  const allowed = await consumeAllowance(userId, "spend");
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
