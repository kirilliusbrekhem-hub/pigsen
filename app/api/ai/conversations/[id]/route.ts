import { handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { deleteConversation, getConversationWithMessages, renameConversation } from "@/lib/ai/conversations";
import { conversationRenameSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const convo = await getConversationWithMessages(user.id, id);
  if (!convo) throw new HttpError(404, "Разговор не найден");
  return json(convo);
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { title } = await parseBody(req, conversationRenameSchema);
  if (!(await renameConversation(user.id, id, title))) throw new HttpError(404, "Разговор не найден");
  return json({ ok: true });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await deleteConversation(user.id, id))) throw new HttpError(404, "Разговор не найден");
  return json({ ok: true });
});
