import { enforceRateLimit, handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { startQuiz } from "@/lib/learning/quiz";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  enforceRateLimit(`quiz:${user.id}`, 10, 10 * 60_000);
  const { id } = await params;
  const quiz = await startQuiz(user.id, id);
  if (!quiz) throw new HttpError(404, "Урок не найден");
  return json(quiz);
});
