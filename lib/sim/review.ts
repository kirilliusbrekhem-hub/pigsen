import "server-only";
import { getAIProvider } from "@/lib/ai/aiService";
import type { AIContext } from "@/lib/ai/types";
import { PROFILES, templateReview, type SimState, type WeekReport } from "./engine";

const SYSTEM = `Ты CAP — AI-наставник Kapital по бизнесу. Пользователь играет в учебный бизнес-симулятор.
Дай короткий разбор недели: 2–3 предложения, по-русски, без markdown и списков, на «вы».
Опирайся только на приведённые цифры (называй их), объясни причину результата и дай один конкретный совет на следующую неделю.`;

const TIMEOUT_MS = 9_000;

/** CAP's take on the week; falls back to template text in demo mode, on errors or on timeout. */
export async function reviewWeek(r: WeekReport, s: SimState): Promise<{ text: string; ai: boolean }> {
  const fallback = { text: templateReview(r, s.kind), ai: false };
  const provider = getAIProvider();
  if (provider.isMock) return fallback;
  const p = PROFILES[s.kind];
  const prompt = `Бизнес: ${p.title}. Неделя ${r.week} из 12. Событие: ${r.event.title}.
Решения: цена ${r.decisions.price} → ${r.price} ₽; реклама ${r.costs.ads} ₽; закупка ${r.costs.stock} ₽; персонал ${r.staff}; кредит ${r.loan} ₽.
Спрос ${r.demand}, продано ${r.sold}, упущено ${r.lost} (склад после: ${r.stock}).
Выручка ${r.revenue} ₽, расходы ${r.totalCosts} ₽ (аренда ${r.costs.rent}, зарплаты ${r.costs.wages}, проценты ${r.costs.interest}, событие ${r.costs.event}), прибыль ${r.profit} ₽.
Касса ${r.cash} ₽, рейтинг ${r.rating} (${r.ratingDelta >= 0 ? "+" : ""}${r.ratingDelta}).`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const ctx: AIContext = { userName: "", tone: "concise", interests: [], learningSummary: "", related: [] };
    let text = "";
    for await (const chunk of provider.stream({ system: SYSTEM, messages: [{ role: "user", content: prompt }], context: ctx, signal: ctl.signal })) {
      text += chunk;
      if (text.length > 900) break;
    }
    text = text.replace(/[*#_`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 700);
    return text.length >= 20 ? { text, ai: true } : fallback;
  } catch (err) {
    console.error("[sim] review failed", err instanceof Error ? err.message : err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
