import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { completeChallenge } from "@/lib/social/service";
import { sanitizeText } from "@/lib/validation/schemas";

const schema = z.object({ note: z.string().transform(sanitizeText).pipe(z.string().min(10, "Минимум 10 символов").max(500, "Максимум 500 символов")) });
type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  enforceRateLimit(`challenge:${user.id}`, 10, 60_000);
  const { id } = await params;
  const { note } = await parseBody(req, schema);
  const r = await completeChallenge(user.id, id, note, isPro(user.profile));
  return json(r);
});
