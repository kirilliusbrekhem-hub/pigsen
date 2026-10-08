import { z } from "zod";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { claimQuest, getQuestBoard } from "@/lib/gamification/quests";

const Body = z.object({ id: z.string().min(1).max(32) });

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json(await getQuestBoard(user.id, isPro(user.profile)));
});

/** Claims a finished quest, the "all 3" chest or the weekly quest. Each reward is paid once (DailyClaim key). */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`quest:${user.id}`, 60, 60_000);
  const { id } = await parseBody(req, Body);
  const r = await claimQuest(user.id, isPro(user.profile), id);
  if (!r.ok) {
    if (r.reason === "claimed") throw new HttpError(409, "Награда уже получена");
    if (r.reason === "unknown") throw new HttpError(404, "Такого задания сегодня нет");
    throw new HttpError(422, "Задание ещё не выполнено");
  }
  return json({ xp: r.xp, coins: r.coins, board: await getQuestBoard(user.id, isPro(user.profile)) });
});
