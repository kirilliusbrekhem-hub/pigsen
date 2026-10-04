import { handler, json, requireApiUser } from "@/lib/api/http";
import { unsaveItem } from "@/lib/content/saved";

type Ctx = { params: Promise<{ contentId: string }> };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { contentId } = await params;
  await unsaveItem(user.id, contentId);
  return json({ saved: false });
});
