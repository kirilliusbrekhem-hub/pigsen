import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/ai/aiService";
import { CATEGORY_IDS, type CategoryId } from "./categorize";
import type { AnalysisResult } from "./aggregate";

/** Strips digits (card/phone numbers) and control chars before anything leaves the server. */
const scrub = (s: string) => s.replace(/\d/g, "").replace(/[\u0000-\u001F<>{}`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/** Optional AI pass: assigns categories to merchants the rules didn't recognize. Demo mode / bad output → unchanged. */
export async function aiCategorizeUnknown(descriptions: string[]): Promise<Map<string, CategoryId>> {
  const uniq = [...new Set(descriptions.map(scrub).filter((s) => s.length >= 3))].slice(0, 40);
  const out = new Map<string, CategoryId>();
  if (!uniq.length) return out;
  const Schema = z.object({ items: z.array(z.object({ i: z.number().int().min(0).max(uniq.length - 1), c: z.enum(CATEGORY_IDS) })).max(60) });
  const res = await completeJson(
    `Ты классифицируешь банковские операции. Категории: ${CATEGORY_IDS.join(", ")}. Отвечай только JSON вида {"items":[{"i":0,"c":"groceries"}]}. Если не уверен — "other".`,
    uniq.map((d, i) => `${i}: ${d}`).join("\n"),
    (raw) => {
      const p = Schema.safeParse(raw);
      return p.success ? p.data : null;
    },
  );
  for (const it of res?.items ?? []) out.set(uniq[it.i], it.c);
  return out;
}
export const scrubKey = scrub;

/** CAP's 3 recommendations from aggregates only (no transactions). Null → keep rule-based ones. */
export async function aiRecommendations(r: AnalysisResult): Promise<string[] | null> {
  const facts = [
    `Период: ${r.from ?? "?"} — ${r.to ?? "?"}, месяцев: ${r.months}. Всего трат: ${r.total} ₽, в среднем ${r.monthlyAvg} ₽/мес.`,
    `Категории: ${r.categories.slice(0, 8).map((c) => `${c.label} ${c.total} ₽ (${c.share}%)`).join("; ")}.`,
    `Утечки: ${r.leaks.map((l) => `${l.title} ~${l.monthly} ₽/мес`).join("; ") || "нет"}.`,
    r.monthCompare ? `Последний месяц ${r.monthCompare.diffPct > 0 ? "+" : ""}${r.monthCompare.diffPct}% к прошлому.` : "",
    `Рекомендуемое откладывание: ${r.suggestedMonthly} ₽/мес.`,
  ].join("\n");
  const Schema = z.object({ recommendations: z.array(z.string().trim().min(20).max(260)).length(3) });
  const res = await completeJson(
    'Ты CAP, финансовый помощник. Дай ровно 3 конкретных совета по сокращению трат с цифрами в рублях из данных. Без общих фраз, без ссылок, без инвестиционных рекомендаций. Ответ только JSON: {"recommendations":["...","...","..."]}',
    facts,
    (raw) => {
      const p = Schema.safeParse(raw);
      return p.success ? p.data : null;
    },
  );
  return res ? res.recommendations.map((s) => s.replace(/[<>`]/g, "").replace(/[\u0000-\u001F]/g, " ")) : null;
}
