import { z } from "zod";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { HttpError, handler, json, parseBody } from "@/lib/api/http";
import { SIM_WEEKS } from "@/lib/sim/engine";
import { requireSimApiUser } from "@/lib/sim/gate";
import { playWeek } from "@/lib/sim/service";

// Only the shape is validated here; the engine also drops any choice that wasn't offered this week.
const Body = z
  .object({
    week: z.number().int().min(1).max(SIM_WEEKS),
    decisions: z
      .object({
        price: z.enum(["down", "keep", "up"]).optional(),
        ad: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
        stock: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
        staff: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
        loan: z.enum(["none", "take", "repay"]).optional(),
      })
      .strict(),
  })
  .strict();

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireSimApiUser();
  await enforceDbRateLimit(`sim-turn:${user.id}`, 30, 60_000);
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new HttpError(404, "Игра не найдена");
  const { week, decisions } = await parseBody(req, Body);
  return json({ run: await playWeek(user.id, id, week, decisions) });
});
