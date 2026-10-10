import "server-only";
import { getCatalogItems } from "@/lib/content/catalog";
import { toContentCard } from "@/lib/content/mappers";
import type { RecommendationDTO } from "@/types";
import type { RecommendationEngine, UserSignals } from "./types";

const W = { interest: 3, saved: 2, completed: 2, viewed: 1, search: 1.5, trending: 0.15, featured: 0.5, seenPenalty: -2.5 };

function tally(ids: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

/**
 * Transparent weighted scoring. Each recommendation carries a human-readable reason.
 * Replace with an embedding- or LLM-based engine by implementing RecommendationEngine.
 */
export const ruleEngine: RecommendationEngine = {
  name: "rules-v1",
  async recommend(_userId: string, s: UserSignals, limit: number): Promise<RecommendationDTO[]> {
    const items = await getCatalogItems();
    const savedCats = tally(s.savedCategoryIds);
    const viewedCats = tally(s.viewedCategoryIds);
    const doneCats = tally(s.completedCategoryIds);

    const scored = items
      .filter((i) => !s.savedIds.has(i.id) && !s.completedCourseItemIds.has(i.id))
      .map((item) => {
        const reasons: Array<[number, string]> = [];
        let score = item.trending * W.trending + (item.featured ? W.featured : 0);
        if (s.interests.includes(item.category.slug)) {
          score += W.interest;
          reasons.push([W.interest, `Вы интересуетесь темой ${item.category.name}`]);
        }
        const sc = Math.min(savedCats.get(item.categoryId) ?? 0, 3) * W.saved;
        if (sc) reasons.push([sc, `Похоже на материалы, которые вы сохранили`]);
        const dc = Math.min(doneCats.get(item.categoryId) ?? 0, 3) * W.completed;
        if (dc) reasons.push([dc, `Продолжение того, что вы изучаете`]);
        const vc = Math.min(viewedCats.get(item.categoryId) ?? 0, 3) * W.viewed;
        if (vc) reasons.push([vc, `Вы часто читаете про ${item.category.name}`]);
        const hits = s.searchTerms.filter((t) => item.searchText.includes(t)).length;
        if (hits) reasons.push([hits * W.search, `По вашему недавнему поиску`]);
        score += sc + dc + vc + hits * W.search;
        if (s.viewedIds.has(item.id)) score += W.seenPenalty;
        reasons.sort((a, b) => b[0] - a[0]);
        const reason = reasons[0]?.[1] ?? (item.trending >= 7 ? "Сейчас популярно в Kapital" : "Выбор редакции Kapital");
        return { item, score, reason };
      })
      .sort((a, b) => b.score - a.score);

    // Diversify: at most two items of the same category in a row of results.
    const perCat = new Map<string, number>();
    const out: RecommendationDTO[] = [];
    for (const r of scored) {
      const n = perCat.get(r.item.categoryId) ?? 0;
      if (n >= 2) continue;
      perCat.set(r.item.categoryId, n + 1);
      out.push({ item: toContentCard(r.item, s.savedIds), score: Math.round(r.score * 10) / 10, reason: r.reason });
      if (out.length >= limit) break;
    }
    return out;
  },
};
