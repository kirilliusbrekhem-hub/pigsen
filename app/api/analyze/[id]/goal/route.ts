import { z } from "zod";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { getAnalysis } from "@/lib/analyze/service";
import { createGoal } from "@/lib/savings/service";

const Input = z.object({ monthly: z.number().int().min(100).max(10_000_000), months: z.number().int().min(1).max(36).default(6) });

/** One-click goal from an analysis: monthly saving × months, deadline accordingly. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`analyze-goal:${user.id}`, 10, 60_000);
  const { id } = await params;
  const a = await getAnalysis(user.id, /^[a-z0-9]{10,40}$/i.test(id) ? id : "-");
  const b = await parseBody(req, Input);
  const deadline = new Date();
  deadline.setUTCMonth(deadline.getUTCMonth() + b.months);
  deadline.setUTCHours(23, 59, 59, 0);
  const goal = await createGoal(user.id, {
    title: "Деньги из разбора трат",
    why: `Откладываю ${b.monthly} ₽ в месяц вместо утечек: ${a.result.leaks.slice(0, 2).map((l) => l.title.toLowerCase()).join(", ") || "лишние траты"}.`.slice(0, 300),
    target: b.monthly * b.months,
    theme: "piggy",
    deadline,
    initial: 0,
  });
  return json({ goal: { id: goal.id } }, 201);
});
