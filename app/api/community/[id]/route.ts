import { handler, json, requireApiUser } from "@/lib/api/http";
import { deletePost } from "@/lib/social/service";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  await deletePost(user, id);
  return json({ ok: true });
});
