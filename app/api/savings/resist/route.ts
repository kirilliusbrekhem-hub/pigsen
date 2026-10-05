import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { resistedSpendReward } from "@/lib/savings/coach";
import { addEntry } from "@/lib/savings/service";
import { sanitizeText } from "@/lib/validation/schemas";

const Body = z.object({
  goalId: z.string().min(1).max(40),
  amount: z.number().int().min(1).max(100_000_000),
  item: z.string().trim().max(120).default(""),
});

/** "I won't buy it": the money goes into the goal and the user gets a small daily reward. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`entry:${user.id}`, 30, 60_000);
  const b = await parseBody(req, Body);
  const item = sanitizeText(b.item);
  const r = await addEntry(user.id, b.goalId, b.amount, item ? `Не потратил на: ${item}`.slice(0, 120) : "Не потратил");
  const bonus = await resistedSpendReward(user.id);
  return json({ ...r, coins: r.coins + bonus });
});
