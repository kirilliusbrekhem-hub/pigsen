import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { ContentCardDTO, ContentType } from "@/types";
import { toContentCard } from "./mappers";

export async function getSavedIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.savedItem.findMany({ where: { userId }, select: { contentItemId: true } });
  return new Set(rows.map((r) => r.contentItemId));
}

export async function saveItem(userId: string, contentItemId: string) {
  const exists = await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { id: true } });
  if (!exists) return null;
  return prisma.savedItem.upsert({
    where: { userId_contentItemId: { userId, contentItemId } },
    update: {},
    create: { userId, contentItemId },
  });
}

export async function unsaveItem(userId: string, contentItemId: string) {
  await prisma.savedItem.deleteMany({ where: { userId, contentItemId } });
}

export async function listSaved(userId: string, type?: ContentType): Promise<Array<{ savedAt: string; item: ContentCardDTO }>> {
  const rows = await prisma.savedItem.findMany({
    where: { userId, ...(type ? { contentItem: { type } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { contentItem: { include: { category: true } } },
  });
  const ids = new Set(rows.map((r) => r.contentItemId));
  return rows.map((r) => ({ savedAt: r.createdAt.toISOString(), item: toContentCard(r.contentItem, ids) }));
}

export const countSaved = (userId: string) => prisma.savedItem.count({ where: { userId } });
