import { enforceRateLimit, handler, json, requireApiUser } from "@/lib/api/http";
import { coachAdvice } from "@/lib/savings/coach";

export const POST = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  enforceRateLimit(`coach:${user.id}`, 6, 60_000);
  const { id } = await params;
  return json(await coachAdvice(user.id, id));
});
