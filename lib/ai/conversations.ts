import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { toContentCard } from "@/lib/content/mappers";
import { getSavedIds } from "@/lib/content/saved";
import type { ConversationSummaryDTO, MessageDTO, MessageRole } from "@/types";
import { MESSAGE_ROLES } from "@/types";

export const DEFAULT_TITLE = "Новый разговор";

const metadataSchema = z.object({
  provider: z.string().optional(),
  related: z.array(z.string()).optional(),
  followUps: z.array(z.string()).optional(),
});
export type MessageMetadata = z.infer<typeof metadataSchema>;

function parseMetadata(raw: string | null): MessageMetadata {
  if (!raw) return {};
  try {
    const r = metadataSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : {};
  } catch {
    return {};
  }
}

export async function listConversations(userId: string): Promise<ConversationSummaryDTO[]> {
  const rows = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take: 100,
  });
  return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(), messageCount: c._count.messages }));
}

export function createConversation(userId: string, title?: string) {
  return prisma.conversation.create({ data: { userId, title: title || DEFAULT_TITLE } });
}

/** Ownership-checked lookup. Returns null for conversations of other users. */
export function findOwnConversation(userId: string, id: string) {
  return prisma.conversation.findFirst({ where: { id, userId } });
}

export async function getConversationWithMessages(userId: string, id: string) {
  const convo = await prisma.conversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) return null;
  const metas = convo.messages.map((m) => parseMetadata(m.metadata));
  const relatedIds = Array.from(new Set(metas.flatMap((m) => m.related ?? [])));
  const [items, saved] = await Promise.all([
    relatedIds.length ? prisma.contentItem.findMany({ where: { id: { in: relatedIds } }, include: { category: true } }) : Promise.resolve([]),
    getSavedIds(userId),
  ]);
  const byId = new Map(items.map((i) => [i.id, toContentCard(i, saved)]));
  const messages: MessageDTO[] = convo.messages
    .map((m, i) => ({ m, meta: metas[i] }))
    .filter(({ m }) => m.role !== "system")
    .map(({ m, meta }) => ({
      id: m.id,
      role: ((MESSAGE_ROLES as readonly string[]).includes(m.role) ? m.role : "user") as MessageRole,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      related: (meta.related ?? []).map((rid) => byId.get(rid)).filter((x): x is NonNullable<typeof x> => Boolean(x)),
      followUps: meta.followUps ?? [],
      provider: meta.provider ?? null,
    }));
  return { id: convo.id, title: convo.title, createdAt: convo.createdAt.toISOString(), messages };
}

export async function appendMessage(conversationId: string, role: MessageRole, content: string, metadata?: MessageMetadata) {
  const [msg] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, role, content, metadata: metadata ? JSON.stringify(metadata) : null } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  return msg;
}

export async function renameConversation(userId: string, id: string, title: string) {
  const r = await prisma.conversation.updateMany({ where: { id, userId }, data: { title } });
  return r.count > 0;
}

export async function deleteConversation(userId: string, id: string) {
  const r = await prisma.conversation.deleteMany({ where: { id, userId } });
  return r.count > 0;
}

export async function deleteAllConversations(userId: string) {
  await prisma.conversation.deleteMany({ where: { userId } });
}
