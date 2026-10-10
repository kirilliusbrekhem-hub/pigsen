import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { awardXp, XP } from "@/lib/gamification/service";
import type { IdeaReviewDTO } from "@/types";
import { completeJson } from "./aiService";
import { consumeAllowance } from "@/lib/billing/limits";

const ResultSchema = z.object({
  score: z.number().int().min(1).max(10),
  verdict: z.string().min(5).max(400),
  strengths: z.array(z.string().min(2).max(300)).min(1).max(5),
  risks: z.array(z.string().min(2).max(300)).min(1).max(5),
  steps: z.array(z.string().min(2).max(300)).min(1).max(5),
});

const SYSTEM = `Ты — CAP, наставник по предпринимательству на платформе Kapital. Пользователь описывает бизнес-идею.
Дай честный и доброжелательный разбор, как опытный ментор-инвестор. Оценивай: понятность проблемы и клиента, рынок, способ заработка, конкуренцию, реализуемость для небольшой команды.
Верни ТОЛЬКО JSON без markdown:
{"score":1-10,"verdict":"вывод в 1–2 предложениях","strengths":["..."],"risks":["..."],"steps":["конкретный первый шаг на эту неделю","..."]}
По 3 пункта в каждом списке, каждый пункт — одно короткое предложение. Язык — русский. Не давай юридических и инвестиционных гарантий.`;

const SIGNALS: Array<{ re: RegExp; strength: string; risk: string; step: string }> = [
  { re: /клиент|пользовател|аудитор|покупател|b2b|b2c/i, strength: "Вы думаете о конкретном клиенте, а не только о продукте.", risk: "Сегмент клиентов пока может быть слишком широким.", step: "Опишите одного идеального клиента: кто он, где его найти, сколько он платит сейчас." },
  { re: /проблем|боль|неудоб|долго|дорого|сложно/i, strength: "Идея опирается на реальную проблему.", risk: "Проблема может быть не настолько острой, чтобы за её решение платили.", step: "Проведите 5 интервью: спросите, как люди решали эту проблему в последний раз и сколько это стоило." },
  { re: /подписк|цен|руб|₽|\$|оплат|комисси|монетиз|продава/i, strength: "Есть мысль о том, как зарабатывать.", risk: "Юнит-экономика ещё не проверена: стоимость привлечения клиента может съесть маржу.", step: "Посчитайте юнит-экономику в калькуляторе Kapital: цена, себестоимость, CAC, отток." },
  { re: /конкурент|аналог|рынок|ниш/i, strength: "Вы учитываете рынок и конкурентов.", risk: "Конкуренты могут быстро скопировать решение без явного преимущества.", step: "Составьте таблицу из 3–5 конкурентов: цена, сильные стороны, чего им не хватает." },
  { re: /ai|ии|нейросет|автоматиз|приложен|сервис|платформ/i, strength: "Технологическая составляющая может дать масштабируемость.", risk: "Разработка может занять больше времени и денег, чем кажется.", step: "Проверьте спрос до кода: лендинг с кнопкой «Оставить заявку» или ручная версия услуги." },
];

/** Rule-based review for demo mode or when the model's JSON doesn't validate. */
function fallbackReview(idea: string): IdeaReviewDTO {
  const hits = SIGNALS.filter((s) => s.re.test(idea));
  const misses = SIGNALS.filter((s) => !s.re.test(idea));
  const score = Math.min(8, 3 + hits.length + (idea.length > 200 ? 1 : 0));
  const strengths = hits.map((h) => h.strength);
  if (!strengths.length) strengths.push("Есть идея и желание её проверить, это первый шаг.");
  const risks = [...misses.map((m) => m.risk), ...hits.map((h) => h.risk)].slice(0, 3);
  const steps = [...misses.map((m) => m.step), ...hits.map((h) => h.step)].slice(0, 3);
  return {
    score,
    verdict: score >= 6 ? "Хорошая основа: идея описана достаточно конкретно, теперь её нужно проверить на реальных клиентах." : "Идее не хватает конкретики. Уточните клиента, проблему и способ заработка, и оценка вырастет.",
    strengths: strengths.slice(0, 3),
    risks,
    steps,
  };
}

export async function reviewIdea(userId: string, idea: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const today = await prisma.ideaReview.count({ where: { userId, createdAt: { gte: since } } });
  // Free and trial plans: a few AI reviews a day, then the rule-based review. Pro: unlimited.
  // The allowance row is taken before the AI call, so parallel requests can't overspend it.
  const useAi = await consumeAllowance(userId, "idea");
  const ai = !useAi ? null : await completeJson(SYSTEM, idea, (raw) => {
    const r = ResultSchema.safeParse(raw);
    return r.success ? r.data : null;
  });
  const result: IdeaReviewDTO = ai ?? fallbackReview(idea);
  // XP once per UTC day, so repeated reviews can't be farmed.
  const saved = await prisma.ideaReview.create({ data: { userId, idea, result: JSON.stringify(result), score: result.score } });
  const xp = await awardXp(userId, today === 0 ? XP.ideaReview : 0);
  return { id: saved.id, result, xp, demo: !ai, limited: !useAi };
}

export async function listIdeaReviews(userId: string, take = 5) {
  const rows = await prisma.ideaReview.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
  return rows.map((r) => ({ id: r.id, idea: r.idea, at: r.createdAt.toISOString(), result: JSON.parse(r.result) as IdeaReviewDTO }));
}
