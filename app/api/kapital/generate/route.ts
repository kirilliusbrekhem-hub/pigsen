import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { sanitizeText } from "@/lib/validation/schemas";
import { generateDraft } from "@/lib/kapital/generate";
import { createFromDraft, hasBusiness } from "@/lib/kapital/service";

const Body = z
  .object({
    idea: z.string().trim().min(3, "Опиши идею чуть подробнее").max(300, "До 300 символов"),
    lang: z.enum(["ru", "en"]).default("ru"),
  })
  .strict();

/** «Опиши бизнес»: AI (or a deterministic template) builds the business and it is created for the user. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`kap-gen:${user.id}`, 5, 10 * 60_000);
  const b = await parseBody(req, Body);
  const idea = sanitizeText(b.idea).replace(/\s+/g, " ");
  if (idea.replace(/[^\p{L}\p{N}]/gu, "").length < 3) throw new HttpError(422, "Опиши идею чуть подробнее", { idea: "Хотя бы пару слов" });
  if (await hasBusiness(user.id)) throw new HttpError(409, "У тебя уже есть бизнес");
  const started = Date.now();
  const draft = await generateDraft(idea, b.lang);
  await createFromDraft(user, idea, draft);
  return json({ draft: { name: draft.name, typeLabel: draft.typeLabel, niche: draft.niche, target: draft.target, monthly: draft.monthly, ai: draft.ai }, ms: Date.now() - started }, 201);
});
