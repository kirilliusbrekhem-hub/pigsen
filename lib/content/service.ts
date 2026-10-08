import "server-only";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { ContentCardDTO, ContentType } from "@/types";
import { toCategoryDTO, toContentCard } from "./mappers";
import { getSavedIds } from "./saved";
import { getCategoriesWithCounts } from "./catalog";

export async function listCategories() {
  const rows = await getCategoriesWithCounts();
  return rows.map((c) => ({ ...toCategoryDTO(c), description: c.description, count: c._count.contents }));
}

export interface ContentFilters {
  type?: ContentType;
  category?: string;
}

export async function listContent(userId: string, filters: ContentFilters = {}): Promise<ContentCardDTO[]> {
  const where: Prisma.ContentItemWhereInput = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.category ? { category: { slug: filters.category } } : {}),
  };
  const [items, saved] = await Promise.all([
    prisma.contentItem.findMany({ where, include: { category: true }, orderBy: [{ featured: "desc" }, { trending: "desc" }, { publishedAt: "desc" }] }),
    getSavedIds(userId),
  ]);
  return items.map((i) => toContentCard(i, saved));
}

export const countByType = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const rows = await prisma.contentItem.groupBy({ by: ["type"], _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.type, r._count._all]));
  },
  ["catalog-count-by-type-v1"],
  { revalidate: 300, tags: ["catalog"] },
);

export async function getContentBySlug(userId: string, slug: string) {
  const [item, saved] = await Promise.all([
    prisma.contentItem.findUnique({ where: { slug }, include: { category: true, course: true } }),
    getSavedIds(userId),
  ]);
  if (!item) return null;
  return { ...toContentCard(item, saved), body: item.body, url: item.url, tags: item.tags ? item.tags.split(",") : [], course: item.course };
}

export async function recordView(userId: string, contentItemId: string) {
  // Collapse repeated views within 10 minutes so refreshes don't inflate history.
  const recent = await prisma.contentView.findFirst({
    where: { userId, contentItemId, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
  });
  if (!recent) await prisma.contentView.create({ data: { userId, contentItemId } });
}

export async function relatedContent(userId: string, item: { id: string; category: { id: string } }, take = 3) {
  const [rows, saved] = await Promise.all([
    prisma.contentItem.findMany({
      where: { categoryId: item.category.id, id: { not: item.id } },
      include: { category: true },
      orderBy: [{ trending: "desc" }, { publishedAt: "desc" }],
      take,
    }),
    getSavedIds(userId),
  ]);
  return rows.map((r) => toContentCard(r, saved));
}

export async function trendingContent(userId: string, take = 6) {
  const [rows, saved] = await Promise.all([
    prisma.contentItem.findMany({
      where: { type: { not: "course" } },
      include: { category: true },
      orderBy: [{ trending: "desc" }, { publishedAt: "desc" }],
      take,
    }),
    getSavedIds(userId),
  ]);
  return rows.map((r) => toContentCard(r, saved));
}

export async function viewHistory(userId: string, take = 20) {
  const [views, saved] = await Promise.all([
    prisma.contentView.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: { contentItem: { include: { category: true } } },
    }),
    getSavedIds(userId),
  ]);
  return views.map((v) => ({ at: v.createdAt.toISOString(), item: toContentCard(v.contentItem, saved) }));
}
