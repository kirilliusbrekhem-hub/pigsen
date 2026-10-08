import { handler, json, requireApiUser } from "@/lib/api/http";
import { deleteAnalysis, getAnalysis } from "@/lib/analyze/service";

type Ctx = { params: Promise<{ id: string }> };
const safeId = (id: string) => (/^[a-z0-9]{10,40}$/i.test(id) ? id : "-");

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  return json(await getAnalysis(user.id, safeId((await params).id)));
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await deleteAnalysis(user.id, safeId((await params).id));
  return json({ ok: true });
});
