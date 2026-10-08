import { handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { awardXp, XP } from "@/lib/gamification/service";
import { setLessonCompleted } from "@/lib/learning/service";
import { trackQuest } from "@/lib/gamification/quests";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const r = await setLessonCompleted(user.id, id, true);
  if (!r) throw new HttpError(404, "Урок не найден");
  const xp = await awardXp(user.id, r.firstCompletion ? XP.lessonCompleted : 0);
  if (r.firstCompletion) await trackQuest(user.id, "lesson");
  return json({ status: "completed", xp });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await setLessonCompleted(user.id, id, false))) throw new HttpError(404, "Урок не найден");
  return json({ status: "in_progress" });
});
