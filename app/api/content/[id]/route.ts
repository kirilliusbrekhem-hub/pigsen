import { prisma } from "@/lib/db/prisma";
import { handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { getContentBySlug, recordView } from "@/lib/content/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET by slug. POST records a view (used for history and recommendations). */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const item = await getContentBySlug(user.id, id);
  if (!item) throw new HttpError(404, "Материал не найден");
  return json(item);
});

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const item = await prisma.contentItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) throw new HttpError(404, "Материал не найден");
  await recordView(user.id, item.id);
  return json({ ok: true });
});
