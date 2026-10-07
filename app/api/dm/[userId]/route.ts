import { z } from "zod";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { listThread, sendDm } from "@/lib/social/dm";
import { DM_MAX } from "@/lib/social/meta";
import { sanitizeText } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ userId: string }> };
const schema = z.object({ text: z.string().transform(sanitizeText).pipe(z.string().min(1, "Пустое сообщение").max(DM_MAX, `Максимум ${DM_MAX} символов`)) });

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { userId } = await params;
  const raw = new URL(req.url).searchParams.get("after");
  const after = raw ? new Date(raw.slice(0, 40)) : undefined;
  if (after && Number.isNaN(after.getTime())) throw new HttpError(422, "Некорректная дата");
  return json({ messages: await listThread(user.id, userId.slice(0, 40), after) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { userId } = await params;
  const body = await parseBody(req, schema);
  enforceRateLimit(`dm:${user.id}`, 20, 60_000);
  return json({ message: await sendDm(user, userId.slice(0, 40), body.text) }, 201);
});
