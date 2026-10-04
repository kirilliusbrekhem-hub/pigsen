import { handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { createConversation, deleteAllConversations, listConversations } from "@/lib/ai/conversations";
import { conversationCreateSchema } from "@/lib/validation/schemas";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ conversations: await listConversations(user.id) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const { title } = await parseBody(req, conversationCreateSchema);
  const c = await createConversation(user.id, title);
  return json({ id: c.id, title: c.title }, 201);
});

export const DELETE = handler(async () => {
  const user = await requireApiUser();
  await deleteAllConversations(user.id);
  return json({ ok: true });
});
