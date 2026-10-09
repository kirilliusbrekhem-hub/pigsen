import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { GoalImageField } from "@/lib/savings/image";
import { sanitizeText } from "@/lib/validation/schemas";
import { submitProof } from "@/lib/biz/proofs";

const schema = z
  .object({
    note: z.string().transform(sanitizeText).pipe(z.string().min(10, "Минимум 10 символов").max(500, "Максимум 500 символов")),
    image: GoalImageField,
  })
  .strict();
type Ctx = { params: Promise<{ id: string }> };

/** «Я выполнил»: the proof goes to admin review; coins and the unique business item come only after approval. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`challenge:${user.id}`, 10, 60_000);
  const { id } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return json({ error: "Челлендж не найден" }, 404);
  const { note, image } = await parseBody(req, schema);
  const r = await submitProof(user.id, "social", id, note, image ?? null, isPro(user.profile));
  return json(r);
});
