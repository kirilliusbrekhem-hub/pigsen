import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { sanitizeText } from "@/lib/validation/schemas";
import { reviewProof } from "@/lib/biz/proofs";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["approve", "reject"]), comment: z.string().max(300).default("").transform(sanitizeText) }).strict();

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const admin = await requireApiAdmin();
  await enforceDbRateLimit(`admin-chs:${admin.id}`, 120, 60_000);
  const { id } = await params;
  const { action, comment } = await parseBody(req, schema);
  return json(await reviewProof(admin.id, id.slice(0, 64), action, comment));
});
