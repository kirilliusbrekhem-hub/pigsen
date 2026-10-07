import { enforceRateLimit, handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { toggleLike } from "@/lib/social/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  if (!isPro(user.profile)) throw new HttpError(403, "Лайки доступны в Pro");
  enforceRateLimit(`like:${user.id}`, 60, 60_000);
  const { id } = await params;
  return json(await toggleLike(user, id.slice(0, 40)));
});
