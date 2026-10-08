import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/ai/aiService";
import type { PlanModel } from "./model";
import type { PlanInput, StepId } from "./schema";
import { STEPS } from "./schema";

export interface PlanSections {
  summary: string;
  market: string;
  marketing: string;
  risks: { risk: string; mitigation: string }[];
}

const SectionsSchema = z.object({
  summary: z.string().min(40).max(1500),
  market: z.string().min(40).max(1500),
  marketing: z.string().min(40).max(1500),
  risks: z.array(z.object({ risk: z.string().min(3).max(300), mitigation: z.string().min(3).max(400) })).min(2).max(8),
});

const fmt = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n))} ₽`;
const months = (n: number | null) => (n === null ? "больше 3 лет" : `${n} мес`);

/** Model output as plain facts for the prompt, so the AI quotes numbers instead of inventing them. */
function facts(input: PlanInput, m: PlanModel): string {
  return [
    `Проект: ${input.title}`,
    `Идея: ${input.idea}`,
    `Клиенты: ${input.audience}`,
    `Конкуренты: ${input.competitors.map((c) => `${c.name} (${fmt(c.price)}${c.note ? `, ${c.note}` : ""})`).join("; ") || "не указаны"}`,
    `Цена: ${fmt(input.price)}, себестоимость: ${fmt(input.unitCost)}, маржа ${m.marginPct}%`,
    `Стартовые вложения: ${fmt(m.startup)}; постоянные расходы в месяц: ${fmt(m.monthlyFixed)}`,
    `Каналы продвижения: ${input.channels.map((c) => `${c.name} (${fmt(c.amount)}/мес)`).join("; ") || "не указаны"}`,
    `Команда: ${input.team.map((t) => t.name).join(", ") || "только основатель"}`,
    `Точка безубыточности: ${m.breakEvenUnits ?? "недостижима"} продаж в месяц; окупаемость: ${months(m.payback)}`,
    `Выручка за год: ${fmt(m.year.revenue)}, чистая прибыль за год: ${fmt(m.year.net)}`,
    `Риски, которые назвал автор: ${input.risks.join("; ") || "не указаны"}`,
  ].join("\n");
}

const SYSTEM = `Ты — $PIG, наставник по предпринимательству на платформе PIGSEN. Помоги начинающему предпринимателю оформить разделы бизнес-плана.
Цифры уже посчитаны финансовой моделью: используй только их, не придумывай новых чисел, долей рынка и статистики.
Верни ТОЛЬКО JSON без markdown:
{"summary":"резюме проекта, 3–4 предложения","market":"клиенты и конкуренты, чем проект отличается, 3–4 предложения","marketing":"план продвижения по указанным каналам, 3–4 предложения","risks":[{"risk":"риск","mitigation":"как его снизить, конкретно"}]}
В risks 3–5 пунктов: включи риски автора и добавь важные недостающие. Язык — русский, просто и по делу. Не давай гарантий доходности.`;

const RISK_LIBRARY: { risk: string; mitigation: string }[] = [
  { risk: "Продажи растут медленнее плана", mitigation: "Держите резерв на 3 месяца постоянных расходов и проверяйте спрос предзаказами до крупных трат." },
  { risk: "Растёт стоимость привлечения клиента", mitigation: "Считайте стоимость клиента по каждому каналу каждую неделю и отключайте каналы дороже маржи с одной продажи." },
  { risk: "Конкурент снижает цену", mitigation: "Соревнуйтесь сервисом и узкой нишей, а не скидками; соберите отзывы и повторные покупки." },
  { risk: "Кассовый разрыв в первые месяцы", mitigation: "Планируйте платежи по месяцам, договоритесь с поставщиками об отсрочке, не тратьте резерв на развитие." },
];

/** Template text from the inputs and the model, used in demo mode or when the AI output doesn't validate. */
export function fallbackSections(input: PlanInput, m: PlanModel): PlanSections {
  const comp = input.competitors.filter((c) => c.name);
  const avg = comp.length ? comp.reduce((s, c) => s + c.price, 0) / comp.length : 0;
  const pos = !avg ? "" : input.price < avg * 0.9 ? " Цена ниже средней по конкурентам — это аргумент для первых клиентов, но маржу нужно беречь." : input.price > avg * 1.1 ? " Цена выше средней по конкурентам, поэтому важно ясно показать, за что клиент доплачивает." : " Цена на уровне конкурентов, отличаться придётся сервисом и подачей.";
  const userRisks = input.risks.map((r) => ({ risk: r, mitigation: RISK_LIBRARY.find((l) => l.risk.toLowerCase() === r.toLowerCase())?.mitigation ?? "Определите ранний сигнал этого риска, назначьте ответственного и заранее решите, что сделаете, если он сработает." }));
  const extra = RISK_LIBRARY.filter((l) => !userRisks.some((u) => u.risk.toLowerCase() === l.risk.toLowerCase()));
  return {
    summary: `${/[«"]/.test(input.title) ? input.title : `«${input.title}»`} — ${input.idea.replace(/\s+/g, " ").slice(0, 400)} Для запуска нужно ${fmt(m.startup)}, постоянные расходы — ${fmt(m.monthlyFixed)} в месяц. По расчёту модели проект выходит в безубыточность при ${m.breakEvenUnits ?? "—"} продажах в месяц и окупается за ${months(m.payback)}. Прогноз чистой прибыли за первый год: ${fmt(m.year.net)}.`,
    market: `Целевые клиенты: ${input.audience.replace(/\s+/g, " ").slice(0, 400)} ${comp.length ? `Основные альтернативы для них: ${comp.map((c) => c.name).join(", ")}${avg ? `, средняя цена — ${fmt(avg)}` : ""}.` : "Конкуренты пока не описаны: стоит найти 3–5 альтернатив, которыми клиенты пользуются сейчас."}${pos}`,
    marketing: input.channels.length
      ? `Продвижение строится на каналах: ${input.channels.map((c) => `${c.name} (${fmt(c.amount)} в месяц)`).join(", ")}. Первые 4–6 недель стоит считать тестом: измеряйте стоимость заявки и продажи в каждом канале и переносите бюджет в тот, где клиент дешевле. Маржа с одной продажи — ${fmt(m.margin)}, привлечение клиента не должно стоить дороже.`
      : `Каналы продвижения пока не выбраны. Начните с бесплатных: личные контакты, сообщества, где есть ваши клиенты, сарафанное радио. Маржа с одной продажи — ${fmt(m.margin)}: это верхняя граница стоимости привлечения клиента.`,
    risks: [...userRisks, ...extra].slice(0, Math.max(3, Math.min(6, userRisks.length + 2))),
  };
}

export async function writeSections(input: PlanInput, m: PlanModel): Promise<{ sections: PlanSections; demo: boolean }> {
  const ai = await completeJson(SYSTEM, facts(input, m), (raw) => {
    const r = SectionsSchema.safeParse(raw);
    return r.success ? r.data : null;
  });
  return ai ? { sections: ai, demo: false } : { sections: fallbackSections(input, m), demo: true };
}

const HintSchema = z.object({ hint: z.string().min(10).max(600) });

/** A short $PIG hint for one wizard step, based on what the user has filled so far. */
export async function stepHint(step: StepId, input: Partial<PlanInput>): Promise<{ hint: string; demo: boolean }> {
  const base = STEPS.find((s) => s.id === step)!;
  const ctx = [input.title && `Проект: ${input.title}`, input.idea && `Идея: ${input.idea}`, input.audience && `Клиенты: ${input.audience}`, input.price && `Цена: ${input.price} ₽, себестоимость ${input.unitCost ?? 0} ₽`]
    .filter(Boolean)
    .join("\n");
  const ai = await completeJson(
    `Ты — $PIG, наставник по предпринимательству. Пользователь заполняет шаг «${base.title}» мастера бизнес-плана. Дай один конкретный совет для его проекта, 2–3 предложения, без выдуманных цифр. Верни ТОЛЬКО JSON: {"hint":"..."}`,
    ctx || "Проект ещё не описан.",
    (raw) => {
      const r = HintSchema.safeParse(raw);
      return r.success ? r.data : null;
    },
  );
  if (ai) return { hint: ai.hint, demo: false };
  let hint: string = base.hint;
  if (step === "pricing" && input.price && input.unitCost !== undefined) {
    const pct = Math.round(((input.price - input.unitCost) / input.price) * 100);
    hint = pct < 30 ? `Маржа сейчас ${pct}% — это мало: любая скидка или рост закупочных цен уведут в минус. Попробуйте поднять цену или найти поставщика дешевле.` : `Маржа ${pct}% — рабочий уровень. Проверьте, что в себестоимость вошли комиссии эквайринга и доставка.`;
  }
  return { hint, demo: true };
}
