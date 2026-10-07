import { z } from "zod";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { listChat, sendChat } from "@/lib/social/chat";
import { CHAT_MAX, isRoom } from "@/lib/social/meta";
import { sanitizeText } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ room: string }> };
const schema = z.object({ text: z.string().transform(sanitizeText).pipe(z.string().min(1, "Пустое сообщение").max(CHAT_MAX, `Максимум ${CHAT_MAX} символов`)) });

async function ctx(params: Ctx["params"]) {
  const user = await requireApiUser();
  if (!isPro(user.profile)) throw new HttpError(403, "Чаты доступны в Pro");
  const { room } = await params;
  if (!isRoom(room)) throw new HttpError(404, "Комната не найдена");
  return { user, room };
}

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { user, room } = await ctx(params);
  const raw = new URL(req.url).searchParams.get("after");
  const after = raw ? new Date(raw.slice(0, 40)) : undefined;
  if (after && Number.isNaN(after.getTime())) throw new HttpError(422, "Некорректная дата");
  return json({ messages: await listChat(user.id, room, after) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { user, room } = await ctx(params);
  const body = await parseBody(req, schema);
  enforceRateLimit(`chat:${user.id}`, 10, 60_000);
  return json({ message: await sendChat(user.id, room, body.text) }, 201);
});
