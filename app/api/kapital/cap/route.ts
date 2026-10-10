import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { sanitizeText } from "@/lib/validation/schemas";
import { capReply } from "@/lib/kapital/service";

const Body = z.object({ text: z.string().trim().min(1, "Пустое сообщение").max(300, "До 300 символов"), lang: z.enum(["ru", "en"]).default("ru") }).strict();

/** One question to CAP. Free has a daily allowance (shared with the AI chat); replies fall back to templates without AI. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`kap-cap:${user.id}`, 15, 60_000);
  const b = await parseBody(req, Body);
  const text = sanitizeText(b.text);
  if (!text) return json({ error: "Пустое сообщение" }, 422);
  return json(await capReply(user, text, b.lang));
});
