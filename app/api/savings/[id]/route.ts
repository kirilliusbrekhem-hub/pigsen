import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { deleteGoal, updateGoal } from "@/lib/savings/service";
import { sanitizeText } from "@/lib/validation/schemas";

const Patch = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  why: z.string().trim().max(300).optional(),
  target: z.number().int().min(100).max(1_000_000_000).optional(),
  theme: z.string().max(20).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  enforceRateLimit(`goal:${user.id}`, 20, 60_000);
  const { id } = await params;
  const b = await parseBody(req, Patch);
  const goal = await updateGoal(user.id, id, {
    ...(b.title !== undefined && { title: sanitizeText(b.title) }),
    ...(b.why !== undefined && { why: sanitizeText(b.why) }),
    ...(b.target !== undefined && { target: b.target }),
    ...(b.theme !== undefined && { theme: b.theme }),
    ...(b.deadline !== undefined && { deadline: b.deadline ? new Date(`${b.deadline}T23:59:59Z`) : null }),
  });
  return json({ goal });
});

export const DELETE = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await deleteGoal(user.id, id);
  return json({ ok: true });
});
