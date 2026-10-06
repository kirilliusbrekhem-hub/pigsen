import "server-only";
import type { GoalView } from "@/components/savings/SavingsHome";
import { goalImageUrl } from "./image";
import { goalStats } from "./service";

export async function toView(g: { id: string; title: string; why: string; target: number; saved: number; theme: string; deadline: Date | null; createdAt: Date; updatedAt: Date; image: string | null }) {
  const s = await goalStats(g);
  const view: GoalView = {
    id: g.id,
    title: g.title,
    why: g.why,
    target: g.target,
    saved: g.saved,
    theme: g.theme,
    imageUrl: goalImageUrl(g),
    deadline: g.deadline?.toISOString() ?? null,
    percent: s.percent,
    needPerMonth: s.needPerMonth,
    eta: s.eta?.toISOString() ?? null,
  };
  return { view, pacePerMonth: Math.round(s.pacePerDay * 30) };
}
