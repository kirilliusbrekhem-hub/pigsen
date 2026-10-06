import { HttpError, handler, requireApiUser } from "@/lib/api/http";
import { getGoal } from "@/lib/savings/service";
import { decodeGoalImage } from "@/lib/savings/image";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const goal = await getGoal(user.id, id);
  const img = goal?.image ? decodeGoalImage(goal.image) : null;
  if (!img) throw new HttpError(404, "Картинки нет");
  return new Response(new Uint8Array(img.body), {
    headers: { "Content-Type": img.type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
});
