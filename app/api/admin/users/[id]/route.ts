import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { applyUserAction } from "@/lib/admin/service";

const Action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pro"), days: z.number().int().min(1).max(3650) }),
  z.object({ kind: z.literal("revokePro") }),
  z.object({ kind: z.literal("coins"), amount: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Не ноль") }),
  z.object({ kind: z.literal("block"), blocked: z.boolean() }),
]);

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireApiAdmin();
  enforceRateLimit(`admin:${admin.id}`, 60, 60_000);
  const { id } = await params;
  await applyUserAction(admin.id, id, await parseBody(req, Action));
  return json({ ok: true });
});
