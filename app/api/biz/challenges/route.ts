import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { GoalImageField } from "@/lib/savings/image";
import { sanitizeText } from "@/lib/validation/schemas";
import { submitProof, PROOF_TEXT_MAX, PROOF_TEXT_MIN } from "@/lib/biz/proofs";
import { getView } from "@/lib/biz/service";

const Body = z
  .object({
    id: z.string().regex(/^[a-z]{1,24}$/),
    text: z.string().transform(sanitizeText).pipe(z.string().min(PROOF_TEXT_MIN, `Минимум ${PROOF_TEXT_MIN} символов`).max(PROOF_TEXT_MAX, `До ${PROOF_TEXT_MAX} символов`)),
    image: GoalImageField,
  })
  .strict();

/** «Выполнил»: sends a savings challenge to admin review (status «на проверке»). Nothing is granted until approval. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-ch:${user.id}`, 10, 60_000);
  const b = await parseBody(req, Body);
  const r = await submitProof(user.id, "biz", b.id, b.text, b.image ?? null, isPro(user.profile));
  return json({ ...r, view: await getView(user, { simulate: false }) });
});
