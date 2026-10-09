import { z } from "zod";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { ProofImageField, attachProof, limitProofUploads, prepareProofImage } from "@/lib/savings/proof";

const Body = z.object({ entryId: z.string().min(1).max(64), image: ProofImageField }).strict();

/** Attach a bank screenshot to an earlier deposit of your own. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const b = await parseBody(req, Body);
  await limitProofUploads(user.id);
  return json({ proof: await attachProof(user.id, b.entryId, prepareProofImage(b.image)) }, 201);
});
