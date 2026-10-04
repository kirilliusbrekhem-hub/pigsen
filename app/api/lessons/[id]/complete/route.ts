import { handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { setLessonCompleted } from "@/lib/learning/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await setLessonCompleted(user.id, id, true))) throw new HttpError(404, "Урок не найден");
  return json({ status: "completed" });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!(await setLessonCompleted(user.id, id, false))) throw new HttpError(404, "Урок не найден");
  return json({ status: "in_progress" });
});
