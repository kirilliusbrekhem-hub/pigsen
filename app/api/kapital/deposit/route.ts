import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { ProofImageField } from "@/lib/savings/proof";
import { deposit, kapitalView } from "@/lib/kapital/service";

const Body = z
  .object({
    amount: z.number().int("Целое число рублей").min(1, "Укажите сумму").max(100_000_000, "Слишком большая сумма"),
    /** Optional bank screenshot (data URL), validated and stripped of metadata server-side. */
    proof: ProofImageField.nullable().optional(),
  })
  .strict();

/** «Отложить»: a real deposit into the member's savings goal; the business capital mirrors it. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`kap-dep:${user.id}`, 20, 60_000);
  const b = await parseBody(req, Body);
  const r = await deposit(user, b.amount, b.proof ?? null);
  const v = await kapitalView(user, { simulate: false });
  return json({ ...r, capital: v?.biz.capital ?? 0, target: v?.biz.target ?? 0, pct: v?.biz.pct ?? 0, streak: v?.streak ?? 0 });
});
