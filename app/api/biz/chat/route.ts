import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { sanitizeText } from "@/lib/validation/schemas";
import { getView, postChat } from "@/lib/biz/service";

const Body = z.object({ text: z.string().trim().min(1, "Пустое сообщение").max(300, "До 300 символов") }).strict();

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`biz-chat:${user.id}`, 15, 60_000);
  const { text } = await parseBody(req, Body);
  const clean = sanitizeText(text);
  if (!clean) return json({ error: "Пустое сообщение" }, 422);
  await postChat(user, clean);
  return json({ view: await getView(user, { simulate: false }) });
});
