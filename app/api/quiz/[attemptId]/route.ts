import { z } from "zod";
import { handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { submitQuiz } from "@/lib/learning/quiz";

type Ctx = { params: Promise<{ attemptId: string }> };
const Body = z.object({ answers: z.array(z.number().int().min(-1).max(3)).min(1).max(5) });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { attemptId } = await params;
  const { answers } = await parseBody(req, Body);
  const r = await submitQuiz(user.id, attemptId, answers);
  if ("error" in r) throw new HttpError(r.error === "done" ? 409 : 404, r.error === "done" ? "Этот квиз уже пройден" : "Квиз не найден");
  return json(r);
});
