import { z } from "zod";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { addEntry } from "@/lib/savings/service";
import { ProofImageField, assertFreshHash, attachProof, limitProofUploads, prepareProofImage } from "@/lib/savings/proof";
import { sanitizeText } from "@/lib/validation/schemas";

const Body = z.object({
  amount: z.number().int("Целое число рублей").refine((n) => n !== 0, "Сумма не может быть нулевой").refine((n) => Math.abs(n) <= 100_000_000, "Слишком большая сумма"),
  note: z.string().trim().max(120).default(""),
  /** Optional screenshot of the bank transfer (data URL) — proof that the deposit is real. */
  proof: ProofImageField.optional(),
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  enforceRateLimit(`entry:${user.id}`, 30, 60_000);
  const { id } = await params;
  const b = await parseBody(req, Body);
  // Validate the screenshot before money moves, so a bad or reused image doesn't leave a half-done deposit.
  let img: ReturnType<typeof prepareProofImage> | null = null;
  if (b.proof) {
    if (b.amount < 0) throw new HttpError(422, "Скриншот прикладывается только к пополнению");
    await limitProofUploads(user.id);
    img = prepareProofImage(b.proof);
    await assertFreshHash(img.hash);
  }
  const r = await addEntry(user.id, id, b.amount, sanitizeText(b.note));
  if (!img) return json(r);
  try {
    return json({ ...r, proof: await attachProof(user.id, r.entryId, img) });
  } catch (e) {
    // The deposit itself succeeded; report the proof problem without failing it.
    if (e instanceof HttpError) return json({ ...r, proof: null, proofError: e.message });
    throw e;
  }
});
