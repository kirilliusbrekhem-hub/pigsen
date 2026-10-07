import { handler, json, requireApiUser } from "@/lib/api/http";
import { deleteChat } from "@/lib/social/chat";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  await deleteChat(user, id.slice(0, 40));
  return json({ ok: true });
});
