import { handler, json, parseBody } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { ContentSchema } from "@/lib/admin/schema";
import { createContent } from "@/lib/admin/service";

export const POST = handler(async (req: Request) => {
  await requireApiAdmin();
  const item = await createContent(await parseBody(req, ContentSchema));
  return json({ id: item.id, slug: item.slug }, 201);
});
