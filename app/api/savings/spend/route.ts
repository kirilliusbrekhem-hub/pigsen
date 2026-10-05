import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { checkSpend } from "@/lib/savings/coach";
import { sanitizeText } from "@/lib/validation/schemas";

const Body = z.object({
  amount: z.number().int("Целое число рублей").min(1, "Укажите сумму").max(100_000_000, "Слишком большая сумма"),
  item: z.string().trim().max(120).default(""),
  goalId: z.string().max(40).nullable().default(null),
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`spend:${user.id}`, 10, 60_000);
  const b = await parseBody(req, Body);
  return json(await checkSpend(user.id, b.amount, sanitizeText(b.item), b.goalId));
});
