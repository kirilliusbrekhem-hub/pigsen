import { handler, json, parseBody } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { ContentSchema } from "@/lib/admin/schema";
import { deleteContent, updateContent } from "@/lib/admin/service";

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireApiAdmin();
  const { id } = await params;
  const item = await updateContent(id, await parseBody(req, ContentSchema));
  return json({ id: item.id, slug: item.slug });
});

export const DELETE = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireApiAdmin();
  const { id } = await params;
  await deleteContent(id);
  return json({ ok: true });
});
