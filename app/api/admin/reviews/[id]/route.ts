import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { moderateReview } from "@/lib/growth/reviews";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["approve", "reject"]) });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const admin = await requireApiAdmin();
  enforceRateLimit(`admin-review:${admin.id}`, 120, 60_000);
  const { id } = await params;
  const { action } = await parseBody(req, schema);
  return json(await moderateReview(id.slice(0, 64), action));
});
