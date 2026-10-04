import { handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { listContent } from "@/lib/content/service";
import { contentQuerySchema } from "@/lib/validation/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireApiUser();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = contentQuerySchema.safeParse(params);
  if (!parsed.success) throw new HttpError(422, "Некорректный фильтр");
  return json({ items: await listContent(user.id, parsed.data) });
});
