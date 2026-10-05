import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { addEntry } from "@/lib/savings/service";
import { sanitizeText } from "@/lib/validation/schemas";

const Body = z.object({
  amount: z.number().int("Целое число рублей").refine((n) => n !== 0, "Сумма не может быть нулевой").refine((n) => Math.abs(n) <= 100_000_000, "Слишком большая сумма"),
  note: z.string().trim().max(120).default(""),
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  enforceRateLimit(`entry:${user.id}`, 30, 60_000);
  const { id } = await params;
  const b = await parseBody(req, Body);
  return json(await addEntry(user.id, id, b.amount, sanitizeText(b.note)));
});
