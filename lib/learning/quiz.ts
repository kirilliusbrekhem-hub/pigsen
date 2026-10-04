import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/ai/aiService";
import { prisma } from "@/lib/db/prisma";
import { awardXp, XP, type XpResult } from "@/lib/gamification/service";

const QuestionSchema = z.object({
  q: z.string().min(5).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  answer: z.number().int().min(0).max(3),
  explain: z.string().max(400).default(""),
});
const QuizSchema = z.object({ questions: z.array(QuestionSchema).min(3).max(5) });
export type QuizQuestion = z.infer<typeof QuestionSchema>;

const SYSTEM = `Ты — $PIG, наставник платформы PIGSEN. Составь короткий квиз по уроку, чтобы проверить понимание, а не память на слова.
Верни ТОЛЬКО JSON без пояснений и без markdown:
{"questions":[{"q":"вопрос","options":["A","B","C","D"],"answer":0,"explain":"почему верно, 1 предложение"}]}
Правила: 4 вопроса; ровно 4 варианта; один верный; правдоподобные неверные варианты; верный вариант в разных позициях; язык — русский.`;

function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function question(q: string, correct: string, wrong: string[], explain: string, seed: number): QuizQuestion | null {
  const pool = [...new Set(wrong.filter((w) => w && w !== correct))].slice(0, 3);
  if (pool.length < 3) return null;
  const options = shuffle([correct, ...pool], seed);
  return { q, options, answer: options.indexOf(correct), explain };
}

const headings = (md: string) => [...md.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].replace(/[*_`]/g, "").trim());

/** Rule-based quiz used in demo mode or when the model's JSON doesn't validate. */
async function fallbackQuiz(lessonId: string): Promise<QuizQuestion[]> {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { course: true } });
  const others = await prisma.lesson.findMany({ where: { id: { not: lessonId } }, include: { course: true } });
  const seed = [...lessonId].reduce((s, c) => s + c.charCodeAt(0), 0);
  const mixed = shuffle(others, seed);
  const own = headings(lesson.body);
  const foreign = mixed.flatMap((o) => headings(o.body)).filter((h) => !own.includes(h));
  const qs = [
    question(`О чём урок «${lesson.title}»?`, lesson.summary, mixed.map((o) => o.summary), `Главная мысль урока: ${lesson.summary}`, seed),
    own[0] ? question("Какой из этих разделов есть в уроке?", own[0], foreign, `В уроке есть раздел «${own[0]}».`, seed + 1) : null,
    own[1] ? question("Что ещё разбирается в этом уроке?", own[1], foreign.slice(3), `Урок разбирает и тему «${own[1]}».`, seed + 2) : null,
    question(
      "К какому курсу относится урок?",
      lesson.course.title,
      mixed.map((o) => o.course.title),
      `Урок входит в курс «${lesson.course.title}».`,
      seed + 3,
    ),
  ];
  return qs.filter((q): q is QuizQuestion => !!q);
}

async function generate(lessonId: string): Promise<QuizQuestion[]> {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  const ai = await completeJson(SYSTEM, `Урок «${lesson.title}».\n\n${lesson.body.slice(0, 12_000)}`, (raw) => {
    const r = QuizSchema.safeParse(raw);
    return r.success ? r.data.questions : null;
  });
  return ai ?? fallbackQuiz(lessonId);
}

export async function startQuiz(userId: string, lessonId: string) {
  const exists = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!exists) return null;
  const questions = await generate(lessonId);
  const attempt = await prisma.quizAttempt.create({
    data: { userId, lessonId, questions: JSON.stringify(questions), total: questions.length },
  });
  return { attemptId: attempt.id, questions: questions.map(({ q, options }) => ({ q, options })) };
}

export async function submitQuiz(userId: string, attemptId: string, answers: number[]) {
  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId } });
  if (!attempt) return { error: "not_found" as const };
  if (attempt.completedAt) return { error: "done" as const };
  const questions = JSON.parse(attempt.questions) as QuizQuestion[];
  const results = questions.map((q, i) => ({ correct: answers[i] === q.answer, answer: q.answer, explain: q.explain }));
  const score = results.filter((r) => r.correct).length;
  // XP is paid once per lesson: only the first finished quiz on a lesson earns it.
  const earlier = await prisma.quizAttempt.count({ where: { userId, lessonId: attempt.lessonId, completedAt: { not: null } } });
  const firstTime = earlier === 0;
  const gained = firstTime ? score * XP.quizCorrect : 0;
  await prisma.quizAttempt.update({ where: { id: attempt.id }, data: { score, xpAwarded: gained, completedAt: new Date() } });
  const xp: XpResult = await awardXp(userId, gained);
  return { score, total: questions.length, results, xp, firstTime };
}
