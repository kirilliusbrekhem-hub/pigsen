import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { reviewProof } from "@/lib/savings/proof";
import { sanitizeText } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().trim().max(200).default("") }).strict();

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const admin = await requireApiAdmin();
  enforceRateLimit(`admin-proof:${admin.id}`, 120, 60_000);
  const { id } = await params;
  const { action, note } = await parseBody(req, schema);
  return json(await reviewProof(admin.id, id.slice(0, 64), action, sanitizeText(note)));
});
