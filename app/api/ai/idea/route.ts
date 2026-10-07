import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { reviewIdea } from "@/lib/ai/idea";
import { sanitizeText } from "@/lib/validation/schemas";

const Body = z.object({ idea: z.string().trim().min(20, "Опишите идею хотя бы в паре предложений").max(2000, "Слишком длинное описание: до 2000 символов") });

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`idea:${user.id}`, 5, 10 * 60_000);
  const { idea } = await parseBody(req, Body);
  return json(await reviewIdea(user.id, sanitizeText(idea)));
});
