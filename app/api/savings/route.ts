import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { createGoal, listGoals } from "@/lib/savings/service";
import { sanitizeText } from "@/lib/validation/schemas";

const GoalInput = z.object({
  title: z.string().trim().min(2, "Назовите цель").max(80, "До 80 символов"),
  why: z.string().trim().max(300, "До 300 символов").default(""),
  target: z.number().int("Целое число рублей").min(100, "Минимум 100 ₽").max(1_000_000_000, "Слишком большая сумма"),
  theme: z.string().max(20).default("piggy"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД").nullable().default(null),
  initial: z.number().int().min(0).max(1_000_000_000).default(0),
});

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ goals: await listGoals(user.id) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`goal:${user.id}`, 20, 60_000);
  const b = await parseBody(req, GoalInput);
  const goal = await createGoal(user.id, {
    title: sanitizeText(b.title),
    why: sanitizeText(b.why),
    target: b.target,
    theme: b.theme,
    deadline: b.deadline ? new Date(`${b.deadline}T23:59:59Z`) : null,
    initial: Math.min(b.initial, b.target * 10, 1_000_000_000),
  });
  return json({ goal }, 201);
});
