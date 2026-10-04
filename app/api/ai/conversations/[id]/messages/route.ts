import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit, handler, HttpError, parseBody, requireApiUser } from "@/lib/api/http";
import { appendMessage, DEFAULT_TITLE, findOwnConversation } from "@/lib/ai/conversations";
import { getAIProvider, streamReply, titleFromQuestion } from "@/lib/ai/aiService";
import { followUpsFor } from "@/lib/ai/followups";
import { AIProviderError, type AIContext, type ChatTurn } from "@/lib/ai/types";
import { TYPE_LABELS } from "@/lib/content/mappers";
import { learningStats } from "@/lib/learning/service";
import { parseInterests, profileTone } from "@/lib/profile/service";
import { search } from "@/lib/search/service";
import { chatMessageSchema } from "@/lib/validation/schemas";
import type { ContentCardDTO } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Streams NDJSON events: meta → delta* → done | error. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  enforceRateLimit(`ai:${user.id}`, 20, 60_000);
  enforceRateLimit(`ai-day:${user.id}`, 300, 24 * 60 * 60_000);
  const { id } = await params;
  const { content } = await parseBody(req, chatMessageSchema);

  const convo = await findOwnConversation(user.id, id);
  if (!convo) throw new HttpError(404, "Разговор не найден");

  // Idempotent retry: if the last message is this same unanswered question, reuse it.
  const last = await prisma.message.findFirst({ where: { conversationId: convo.id }, orderBy: { createdAt: "desc" } });
  const userMsg = last && last.role === "user" && last.content === content ? last : await appendMessage(convo.id, "user", content);
  if (convo.title === DEFAULT_TITLE) {
    await prisma.conversation.update({ where: { id: convo.id }, data: { title: titleFromQuestion(content) } });
  }

  const [history, related, stats, categories] = await Promise.all([
    prisma.message.findMany({ where: { conversationId: convo.id, role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "asc" }, take: 40 }),
    relatedFor(user.id, content),
    learningStats(user.id),
    prisma.category.findMany({ select: { slug: true, name: true } }),
  ]);
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const context: AIContext = {
    userName: user.name,
    tone: profileTone(user.profile),
    interests: parseInterests(user.profile).map((s) => catName.get(s) ?? s),
    learningSummary: `пройдено ${stats.lessonsCompleted} из ${stats.totalLessons} уроков, начато курсов: ${stats.coursesStarted}`,
    related: related.map((r) => ({ title: r.title, type: TYPE_LABELS[r.type].one, description: r.description, href: r.href })),
  };
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  const provider = getAIProvider();
  const followUps = followUpsFor(content);

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: object) =>
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      send(controller, { type: "meta", userMessageId: userMsg.id, provider: provider.label, mock: provider.isMock, related, followUps });
      let answer = "";
      try {
        for await (const delta of streamReply(turns, context, req.signal)) {
          answer += delta;
          send(controller, { type: "delta", text: delta });
        }
        if (!answer.trim()) throw new AIProviderError("empty", "$PIG не смог сформулировать ответ. Попробуйте ещё раз.");
        const saved = await appendMessage(convo.id, "assistant", answer, {
          provider: provider.label,
          related: related.map((r) => r.id),
          followUps,
        });
        send(controller, { type: "done", messageId: saved.id });
      } catch (err) {
        console.error("[ai] stream failed", err instanceof Error ? err.message : err);
        if (answer.trim()) await appendMessage(convo.id, "assistant", answer, { provider: provider.label });
        const message = err instanceof AIProviderError ? err.userMessage : "Не удалось получить ответ. Попробуйте ещё раз.";
        send(controller, { type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
});

async function relatedFor(userId: string, question: string): Promise<ContentCardDTO[]> {
  const r = await search(userId, question, undefined, false);
  if (r.content.length) return r.content.slice(0, 3);
  // Fall back to term-by-term matching for long natural-language questions.
  const terms = question.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((t) => t.length > 4).slice(0, 6);
  const seen = new Map<string, ContentCardDTO>();
  for (const t of terms) {
    const stem = t.slice(0, Math.max(5, t.length - 2));
    const hit = await search(userId, stem, undefined, false);
    for (const c of hit.content.slice(0, 2)) if (!seen.has(c.id)) seen.set(c.id, c);
    if (seen.size >= 3) break;
  }
  return [...seen.values()].slice(0, 3);
}
