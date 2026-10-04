import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { RecommendationDTO } from "@/types";
import { collectSignals } from "./signals";
import { ruleEngine } from "./rule-engine";
import type { RecommendationEngine } from "./types";

// Swap the engine here (e.g. an AI/embedding engine) without touching callers.
const engine: RecommendationEngine = ruleEngine;

export async function getRecommendations(userId: string, limit = 6): Promise<RecommendationDTO[]> {
  const signals = await collectSignals(userId);
  return engine.recommend(userId, signals, limit);
}

export interface InterestWeight {
  slug: string;
  name: string;
  weight: number; // 0..1, relative to the strongest interest
}

/** How PIGSEN currently sees the user's interests, for the dashboard "interest profile". */
export async function getInterestProfile(userId: string, take = 4): Promise<InterestWeight[]> {
  const [s, cats] = await Promise.all([collectSignals(userId), prisma.category.findMany()]);
  const scores = cats.map((c) => {
    let v = s.interests.includes(c.slug) ? 3 : 0;
    v += s.savedCategoryIds.filter((id) => id === c.id).length * 2;
    v += s.completedCategoryIds.filter((id) => id === c.id).length * 2;
    v += s.viewedCategoryIds.filter((id) => id === c.id).length;
    return { slug: c.slug, name: c.name, raw: v };
  });
  const top = scores.filter((x) => x.raw > 0).sort((a, b) => b.raw - a.raw).slice(0, take);
  const max = top[0]?.raw ?? 1;
  return top.map((t) => ({ slug: t.slug, name: t.name, weight: t.raw / max }));
}
